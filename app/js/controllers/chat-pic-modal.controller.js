(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('ChatpicModalController', ChatpicModalController)


    function ChatpicModalController ( $q, $scope, $rootScope, $modalInstance, MtpApiManager, AppPhotosManager, AppChatsManager, AppPeersManager, AppMessagesManager, ApiUpdatesManager, PeersSelectService, ErrorService ) {
        $scope.photo = AppPhotosManager.wrapForFull($scope.photoID)
        $scope.photo.thumb = {
          location: AppPhotosManager.choosePhotoSize($scope.photo, 0, 0).location
        }
    
        var chat = AppChatsManager.getChat($scope.chatID)
        var isChannel = AppChatsManager.isChannel($scope.chatID)
    
        $scope.canForward = true
        $scope.canDelete = isChannel ? chat.pFlags.creator : true
    
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
          ErrorService.confirm({type: 'PHOTO_DELETE'}).then(function () {
            $scope.photo.updating = true
            var apiPromise
            if (AppChatsManager.isChannel($scope.chatID)) {
              apiPromise = MtpApiManager.invokeApi('channels.editPhoto', {
                channel: AppChatsManager.getChannelInput($scope.chatID),
                photo: {_: 'inputChatPhotoEmpty'}
              })
            } else {
              apiPromise = MtpApiManager.invokeApi('messages.editChatPhoto', {
                chat_id: AppChatsManager.getChatInput($scope.chatID),
                photo: {_: 'inputChatPhotoEmpty'}
              })
            }
            apiPromise.then(function (updates) {
              ApiUpdatesManager.processUpdateMessage(updates)
              $modalInstance.dismiss()
              $rootScope.$broadcast('history_focus', {peerString: AppChatsManager.getChatString($scope.chatID)})
            })['finally'](function () {
              $scope.photo.updating = false
            })
          })
        }
    
        $scope.download = function () {
          AppPhotosManager.downloadPhoto($scope.photoID)
        }
    }
    
})()
