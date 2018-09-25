(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('UserpicModalController', UserpicModalController)

    function UserpicModalController ( $q, $scope, $rootScope, $modalInstance, MtpApiManager, AppPhotosManager, AppUsersManager, AppPeersManager, AppMessagesManager, ApiUpdatesManager, PeersSelectService, ErrorService ) {
        $scope.photo = AppPhotosManager.wrapForFull($scope.photoID)
        $scope.photo.thumb = {
          location: AppPhotosManager.choosePhotoSize($scope.photo, 0, 0).location
        }
    
        $scope.nav = {}
        $scope.canForward = true
    
        var list = [$scope.photoID]
        var maxID = $scope.photoID
        var preloaded = {}
        var myID = 0
        var hasMore = true
    
        updatePrevNext()
    
        AppPhotosManager.getUserPhotos($scope.userID, 0, 1000).then(function (userpicCachedResult) {
          if (userpicCachedResult.photos.indexOf($scope.photoID) >= 0) {
            list = userpicCachedResult.photos
            maxID = list[list.length - 1]
          }
          hasMore = list.length < userpicCachedResult.count
          updatePrevNext()
        })
    
        MtpApiManager.getUserID().then(function (id) {
          myID = id
          $scope.canDelete = $scope.photo.user_id == myID
        })
    
        var jump = 0
        function movePosition (sign, deleteCurrent) {
          var curIndex = list.indexOf($scope.photoID)
          var index = curIndex >= 0 ? curIndex + sign : 0
          var curJump = ++jump
    
          var promise = index >= list.length ? loadMore() : $q.when()
          promise.then(function () {
            if (curJump != jump) {
              return
            }
    
            $scope.photoID = list[index]
            $scope.photo = AppPhotosManager.wrapForFull($scope.photoID)
            $scope.photo.thumb = {
              location: AppPhotosManager.choosePhotoSize($scope.photo, 0, 0).location
            }
    
            var newCount
            if (deleteCurrent) {
              list.splice(curIndex, 1)
              newCount = $scope.count - 1
            }
    
            updatePrevNext(newCount)
    
            preloaded[$scope.photoID] = true
    
            updatePrevNext()
    
            if (sign > 0 && hasMore && list.indexOf($scope.photoID) + 1 >= list.length) {
              loadMore()
            } else {
              preloadPhotos(sign)
            }
          })
        }
    
        function preloadPhotos (sign) {
          var preloadOffsets = sign < 0 ? [-1, -2] : [1, 2]
          var index = list.indexOf($scope.photoID)
          angular.forEach(preloadOffsets, function (offset) {
            var photoID = list[index + offset]
            if (photoID !== undefined && preloaded[photoID] === undefined) {
              preloaded[photoID] = true
              AppPhotosManager.preloadPhoto(photoID)
            }
          })
        }
    
        var loadingPromise = false
        function loadMore () {
          if (loadingPromise) return loadingPromise
    
          return loadingPromise = AppPhotosManager.getUserPhotos($scope.userID, maxID).then(function (userpicResult) {
            if (userpicResult.photos.length) {
              maxID = userpicResult.photos[userpicResult.photos.length - 1]
              list = list.concat(userpicResult.photos)
    
              hasMore = list.length < userpicResult.count
            } else {
              hasMore = false
            }
    
            updatePrevNext(userpicResult.count)
            loadingPromise = false
    
            if (userpicResult.photos.length) {
              return $q.reject()
            }
    
            preloadPhotos(+1)
          })
        }
    
        function updatePrevNext (count) {
          var index = list.indexOf($scope.photoID)
          if (hasMore) {
            if (count) {
              $scope.count = Math.max(count, list.length)
            }
          } else {
            $scope.count = list.length
          }
          $scope.pos = $scope.count - index
          $scope.nav.hasNext = index > 0
          $scope.nav.hasPrev = hasMore || index < list.length - 1
          $scope.canDelete = $scope.photo.user_id == myID
        }
    
        $scope.nav.next = function () {
          if (!$scope.nav.hasNext) {
            return false
          }
    
          movePosition(-1)
        }
    
        $scope.nav.prev = function () {
          if (!$scope.nav.hasPrev) {
            return false
          }
          movePosition(+1)
        }
    
        $scope.forward = function () {
          PeersSelectService.selectPeer({confirm_type: 'FORWARD_PEER', canSend: true}).then(function (peerString) {
            var peerID = AppPeersManager.getPeerID(peerString)
            AppMessagesManager.sendOther(peerID, {
              _: 'inputMediaPhoto',
              id: {
                _: 'inputPhoto',
                id: $scope.photoID,
                access_hash: $scope.photo.access_hash
              }
            })
            $rootScope.$broadcast('history_focus', {peerString: peerString})
          })
        }
    
        $scope['delete'] = function () {
          var photoID = $scope.photoID
          var myUser = AppUsersManager.getUser(myID)
          var onDeleted = function () {
            if (!$scope.nav.hasNext && !$scope.nav.hasPrev) {
              return $modalInstance.dismiss()
            }
            movePosition($scope.nav.hasNext ? -1 : +1, true)
          }
    
          ErrorService.confirm({type: 'PHOTO_DELETE'}).then(function () {
            if (myUser && myUser.photo && myUser.photo.photo_id == photoID) {
              MtpApiManager.invokeApi('photos.updateProfilePhoto', {
                id: {_: 'inputPhotoEmpty'}
              }).then(function (updateResult) {
                ApiUpdatesManager.processUpdateMessage({
                  _: 'updateShort',
                  update: {
                    _: 'updateUserPhoto',
                    user_id: myID,
                    date: tsNow(true),
                    photo: updateResult,
                    previous: true
                  }
                })
                onDeleted()
              })
            } else {
              MtpApiManager.invokeApi('photos.deletePhotos', {
                id: [{_: 'inputPhoto', id: photoID, access_hash: 0}]
              }).then(onDeleted)
            }
          })
        }
    
        $scope.download = function () {
          AppPhotosManager.downloadPhoto($scope.photoID)
        }
    }

})()
