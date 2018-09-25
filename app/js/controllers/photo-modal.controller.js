(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('PhotoModalController', PhotoModalController)
    
    function PhotoModalController ( $q, $scope, $rootScope, $modalInstance, AppPhotosManager, AppMessagesManager, AppPeersManager, AppWebPagesManager, PeersSelectService, ErrorService ) {
        $scope.photo = AppPhotosManager.wrapForFull($scope.photoID)
        $scope.nav = {}
    
        $scope.download = function () {
          AppPhotosManager.downloadPhoto($scope.photoID)
        }
    
        if (!$scope.messageID) {
          return
        }
    
        $scope.forward = function () {
          var messageID = $scope.messageID
    
          PeersSelectService.selectPeer({canSend: true}).then(function (peerString) {
            $rootScope.$broadcast('history_focus', {
              peerString: peerString,
              attachment: {
                _: 'fwd_messages',
                id: [messageID]
              }
            })
          })
        }
    
        $scope.goToMessage = function () {
          var messageID = $scope.messageID
          var peerID = AppMessagesManager.getMessagePeer(AppMessagesManager.getMessage(messageID))
          var peerString = AppPeersManager.getPeerString(peerID)
          $modalInstance.dismiss()
          $rootScope.$broadcast('history_focus', {peerString: peerString, messageID: messageID})
        }
    
        $scope['delete'] = function () {
          var messageID = $scope.messageID
          ErrorService.confirm({type: 'MESSAGE_DELETE'}).then(function () {
            AppMessagesManager.deleteMessages([messageID])
          })
        }
    
        var peerID = AppMessagesManager.getMessagePeer(AppMessagesManager.getMessage($scope.messageID))
        var inputPeer = AppPeersManager.getInputPeerByID(peerID)
        var inputQuery = ''
        var inputFilter = {_: 'inputMessagesFilterPhotos'}
        var list = [$scope.messageID]
        var preloaded = {}
        var maxID = $scope.messageID
        var hasMore = true
    
        preloaded[$scope.messageID] = true
    
        updatePrevNext()
    
        function preloadPhotos (sign) {
          // var preloadOffsets = sign < 0 ? [-1,-2,1,-3,2] : [1,2,-1,3,-2]
          var preloadOffsets = sign < 0 ? [-1, -2] : [1, 2]
          var index = list.indexOf($scope.messageID)
          angular.forEach(preloadOffsets, function (offset) {
            var messageID = list[index + offset]
            if (messageID !== undefined && preloaded[messageID] === undefined) {
              preloaded[messageID] = true
              var message = AppMessagesManager.getMessage(messageID)
              var photoID = message.media.photo.id
              AppPhotosManager.preloadPhoto(photoID)
            }
          })
        }
    
        function updatePrevNext (count) {
          var index = list.indexOf($scope.messageID)
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
          $scope.canForward = $scope.canDelete = $scope.messageID > 0
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
    
        $scope.$on('history_delete', function (e, historyUpdate) {
          if (historyUpdate.peerID == peerID) {
            if (historyUpdate.msgs[$scope.messageID]) {
              if ($scope.nav.hasNext) {
                $scope.nav.next()
              } else if ($scope.nav.hasPrev) {
                $scope.nav.prev()
              } else {
                return $modalInstance.dismiss()
              }
            }
            var newList = []
            for (var i = 0; i < list.length; i++) {
              if (!historyUpdate.msgs[list[i]]) {
                newList.push(list[i])
              }
            }
            list = newList
          }
        })
    
        if ($scope.webpageID) {
          $scope.webpage = AppWebPagesManager.wrapForHistory($scope.webpageID)
          return
        }
    
        AppMessagesManager.getSearch(peerID, inputQuery, inputFilter, 0, 1000).then(function (searchCachedResult) {
          if (searchCachedResult.history.indexOf($scope.messageID) >= 0) {
            list = searchCachedResult.history
            maxID = list[list.length - 1]
    
            updatePrevNext()
            preloadPhotos(+1)
          }
          loadMore()
        }, loadMore)
    
        var jump = 0
        function movePosition (sign) {
          var curIndex = list.indexOf($scope.messageID)
          var index = curIndex >= 0 ? curIndex + sign : 0
          var curJump = ++jump
    
          var promise = index >= list.length ? loadMore() : $q.when()
          promise.then(function () {
            if (curJump != jump) {
              return
            }
    
            var messageID = list[index]
            var message = AppMessagesManager.getMessage(messageID)
            var photoID = message && message.media &&
              ((message.media.photo && message.media.photo.id) ||
                (message.media.webpage && message.media.webpage.photo && message.media.webpage.photo.id))
            if (!photoID) {
              console.error('Invalid photo message', index, list, messageID, message)
              return
            }
    
            $scope.messageID = messageID
            $scope.photoID = photoID
            $scope.photo = AppPhotosManager.wrapForFull($scope.photoID)
    
            preloaded[$scope.messageID] = true
    
            updatePrevNext()
    
            if (sign > 0 && hasMore && list.indexOf(messageID) + 1 >= list.length) {
              loadMore()
            } else {
              preloadPhotos(sign)
            }
          })
        }
    
        var loadingPromise = false
        function loadMore () {
          if (loadingPromise) return loadingPromise
    
          return loadingPromise = AppMessagesManager.getSearch(peerID, inputQuery, inputFilter, maxID).then(function (searchResult) {
            if (searchResult.history.length) {
              maxID = searchResult.history[searchResult.history.length - 1]
              list = list.concat(searchResult.history)
              hasMore = list.length < searchResult.count
            } else {
              hasMore = false
            }
    
            updatePrevNext(searchResult.count)
            loadingPromise = false
    
            if (searchResult.history.length) {
              return $q.reject()
            }
    
            preloadPhotos(+1)
          })
        }
    }

})()
