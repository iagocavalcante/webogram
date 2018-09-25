(function () {
  'use strict'
  angular
    .module('chat-modal.controller', ['myApp.i18n'])
    .controller('ChatModalController', ChatModalController)

  function ChatModalController ( $scope, $modalInstance, $location, $timeout, $rootScope, $modal, AppUsersManager, AppChatsManager, AppProfileManager, AppPhotosManager, MtpApiManager, MtpApiFileManager, NotificationsManager, AppMessagesManager, AppPeersManager, ApiUpdatesManager, ContactsSelectService, ErrorService ) {
    $scope.chatFull = AppChatsManager.wrapForFull($scope.chatID, {})
    $scope.settings = {notifications: true}

    $scope.maxParticipants = 200

    AppProfileManager.getChatFull($scope.chatID).then(function (chatFull) {
      $scope.chatFull = AppChatsManager.wrapForFull($scope.chatID, chatFull)
      $scope.$broadcast('ui_height')

      $scope.needMigrate = $scope.chatFull &&
        $scope.chatFull.participants &&
        $scope.chatFull.participants.participants &&
        $scope.chatFull.participants.participants.length >= 200

      if (Config.Modes.test || Config.Modes.debug) {
        $scope.needMigrate = true
      }

      NotificationsManager.getPeerMuted(-$scope.chatID).then(function (muted) {
        $scope.settings.notifications = !muted

        $scope.$watch('settings.notifications', function (newValue, oldValue) {
          if (newValue === oldValue) {
            return false
          }
          NotificationsManager.getPeerSettings(-$scope.chatID).then(function (settings) {
            if (newValue) {
              settings.mute_until = 0
            } else {
              settings.mute_until = 2000000000
            }
            NotificationsManager.updatePeerSettings(-$scope.chatID, settings)
          })
        })
      })
    })

    function onChatUpdated (updates) {
      ApiUpdatesManager.processUpdateMessage(updates)
      $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
    }

    $scope.leaveGroup = function () {
      ErrorService.confirm({type: 'HISTORY_LEAVE_AND_FLUSH'}).then(function () {
        MtpApiManager.invokeApi('messages.deleteChatUser', {
          chat_id: AppChatsManager.getChatInput($scope.chatID),
          user_id: {_: 'inputUserSelf'}
        }).then(function (updates) {
          ApiUpdatesManager.processUpdateMessage(updates)
          AppMessagesManager.flushHistory(-$scope.chatID).then(function () {
            $modalInstance.close()
            $location.url('/im')
          })
        })
      })
    }

    $scope.inviteToGroup = function () {
      var disabled = []
      angular.forEach($scope.chatFull.participants.participants, function (participant) {
        disabled.push(participant.user_id)
      })

      ContactsSelectService.selectContacts({disabled: disabled}).then(function (userIDs) {
        angular.forEach(userIDs, function (userID) {
          MtpApiManager.invokeApi('messages.addChatUser', {
            chat_id: AppChatsManager.getChatInput($scope.chatID),
            user_id: AppUsersManager.getUserInput(userID),
            fwd_limit: 100
          }).then(function (updates) {
            ApiUpdatesManager.processUpdateMessage(updates)
          })
        })

        $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
      })
    }

    $scope.migrateToSuperGroup = function () {
      ErrorService.confirm({type: 'SUPERGROUP_MIGRATE'}).then(function () {
        MtpApiManager.invokeApi('messages.migrateChat', {
          chat_id: AppChatsManager.getChatInput($scope.chatID)
        }).then(onChatUpdated)
      })
    }

    $scope.kickFromGroup = function (userID) {
      MtpApiManager.invokeApi('messages.deleteChatUser', {
        chat_id: AppChatsManager.getChatInput($scope.chatID),
        user_id: AppUsersManager.getUserInput(userID)
      }).then(onChatUpdated)
    }

    $scope.flushHistory = function (justClear) {
      ErrorService.confirm({type: justClear ? 'HISTORY_FLUSH' : 'HISTORY_FLUSH_AND_DELETE'}).then(function () {
        AppMessagesManager.flushHistory(-$scope.chatID, justClear).then(function () {
          if (justClear) {
            $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
          } else {
            $modalInstance.close()
            $location.url('/im')
          }
        })
      })
    }

    $scope.inviteViaLink = function () {
      var scope = $rootScope.$new()
      scope.chatID = $scope.chatID

      $modal.open({
        templateUrl: templateUrl('chat_invite_link_modal'),
        controller: 'ChatInviteLinkModalController',
        scope: scope,
        windowClass: 'md_simple_modal_window'
      })
    }

    $scope.photo = {}

    $scope.$watch('photo.file', onPhotoSelected)

    function onPhotoSelected (photo) {
      if (!photo || !photo.type || photo.type.indexOf('image') !== 0) {
        return
      }
      $scope.photo.updating = true
      MtpApiFileManager.uploadFile(photo).then(function (inputFile) {
        return MtpApiManager.invokeApi('messages.editChatPhoto', {
          chat_id: AppChatsManager.getChatInput($scope.chatID),
          photo: {
            _: 'inputChatUploadedPhoto',
            file: inputFile
          }
        }).then(onChatUpdated)
      })['finally'](function () {
        $scope.photo.updating = false
      })
    }

    $scope.deletePhoto = function () {
      $scope.photo.updating = true
      MtpApiManager.invokeApi('messages.editChatPhoto', {
        chat_id: AppChatsManager.getChatInput($scope.chatID),
        photo: {_: 'inputChatPhotoEmpty'}
      }).then(onChatUpdated)['finally'](function () {
        $scope.photo.updating = false
      })
    }

    $scope.editTitle = function () {
      var scope = $rootScope.$new()
      scope.chatID = $scope.chatID

      $modal.open({
        templateUrl: templateUrl('chat_edit_modal'),
        controller: 'ChatEditModalController',
        scope: scope,
        windowClass: 'md_simple_modal_window mobile_modal'
      })
    }

    $scope.hasRights = function (action) {
      return AppChatsManager.hasRights($scope.chatID, action)
    }
  }

})()
