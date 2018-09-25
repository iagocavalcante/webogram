(function () {
  'use strict'
  angular
    .module('channel-modal.controller', ['myApp.i18n'])
    .controller('ChannelModalController', ChannelModalController)

  function ChannelModalController ( $rootScope, $scope, $timeout, $modal, AppUsersManager, AppChatsManager, AppPhotosManager, MtpApiManager, Storage, NotificationsManager, MtpApiFileManager, PasswordManager, ApiUpdatesManager, ChangelogNotifyService, LayoutSwitchService, WebPushApiManager, AppRuntimeManager, ErrorService, _ ) {
    $scope.chatFull = AppChatsManager.wrapForFull($scope.chatID, {})
    $scope.settings = {notifications: true}
    $scope.isMegagroup = AppChatsManager.isMegagroup($scope.chatID)

    AppProfileManager.getChannelFull($scope.chatID, true).then(function (chatFull) {
      $scope.chatFull = AppChatsManager.wrapForFull($scope.chatID, chatFull)
      $scope.$broadcast('ui_height')

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

      if ($scope.chatFull.chat &&
        $scope.chatFull.chat.pFlags.creator &&
        $scope.chatFull.exported_invite &&
        $scope.chatFull.exported_invite._ == 'chatInviteEmpty') {
        AppProfileManager.getChatInviteLink($scope.chatID, true).then(function (link) {
          $scope.chatFull.exported_invite = {_: 'chatInviteExported', link: link}
        })
      }
    })

    AppProfileManager.getChannelParticipants($scope.chatID).then(function (participants) {
      $scope.participants = AppChatsManager.wrapParticipants($scope.chatID, participants)
      $scope.$broadcast('ui_height')
    })


    function onChatUpdated (updates) {
      ApiUpdatesManager.processUpdateMessage(updates)
      $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
      if (updates &&
          updates.updates &&
          updates.updates.length &&
          AppChatsManager.isChannel($scope.chatID)) {
        AppProfileManager.invalidateChannelParticipants($scope.chatID)
      }
    }

    $scope.leaveChannel = function () {
      return ErrorService.confirm({type: $scope.isMegagroup ? 'MEGAGROUP_LEAVE' : 'CHANNEL_LEAVE'}).then(function () {
        MtpApiManager.invokeApi('channels.leaveChannel', {
          channel: AppChatsManager.getChannelInput($scope.chatID)
        }).then(onChatUpdated)
      })
    }

    $scope.deleteChannel = function () {
      return ErrorService.confirm({type: $scope.isMegagroup ? 'MEGAGROUP_DELETE' : 'CHANNEL_DELETE'}).then(function () {
        MtpApiManager.invokeApi('channels.deleteChannel', {
          channel: AppChatsManager.getChannelInput($scope.chatID)
        }).then(onChatUpdated)
      })
    }

    $scope.flushHistory = function () {
      ErrorService.confirm({type: 'HISTORY_FLUSH'}).then(function () {
        AppMessagesManager.flushHistory(-$scope.chatID).then(function () {
          $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
        })
      })
    }

    $scope.joinChannel = function () {
      MtpApiManager.invokeApi('channels.joinChannel', {
        channel: AppChatsManager.getChannelInput($scope.chatID)
      }).then(onChatUpdated)
    }

    $scope.inviteToChannel = function () {
      var disabled = []
      angular.forEach(($scope.chatFull.participants || {}).participants || [], function (participant) {
        disabled.push(participant.user_id)
      })

      ContactsSelectService.selectContacts({disabled: disabled}).then(function (userIDs) {
        var inputUsers = []
        angular.forEach(userIDs, function (userID) {
          inputUsers.push(AppUsersManager.getUserInput(userID))
        })
        MtpApiManager.invokeApi('channels.inviteToChannel', {
          channel: AppChatsManager.getChannelInput($scope.chatID),
          users: inputUsers
        }).then(onChatUpdated)
      })
    }

    $scope.kickFromChannel = function (userID) {
      MtpApiManager.invokeApi('channels.editBanned', {
        channel: AppChatsManager.getChannelInput($scope.chatID),
        user_id: AppUsersManager.getUserInput(userID),
        banned_rights: {_: 'channelBannedRights', flags: 1, until_date: 0}
      }).then(onChatUpdated)
    }

    $scope.shareLink = function ($event) {
      var scope = $rootScope.$new()
      scope.chatID = $scope.chatID

      $modal.open({
        templateUrl: templateUrl('chat_invite_link_modal'),
        controller: 'ChatInviteLinkModalController',
        scope: scope,
        windowClass: 'md_simple_modal_window'
      })

      return cancelEvent($event)
    }

    $scope.photo = {}

    $scope.$watch('photo.file', onPhotoSelected)

    function onPhotoSelected (photo) {
      if (!photo || !photo.type || photo.type.indexOf('image') !== 0) {
        return
      }
      $scope.photo.updating = true
      MtpApiFileManager.uploadFile(photo).then(function (inputFile) {
        return MtpApiManager.invokeApi('channels.editPhoto', {
          channel: AppChatsManager.getChannelInput($scope.chatID),
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
      MtpApiManager.invokeApi('channels.editPhoto', {
        channel: AppChatsManager.getChannelInput($scope.chatID),
        photo: {_: 'inputChatPhotoEmpty'}
      }).then(onChatUpdated)['finally'](function () {
        $scope.photo.updating = false
      })
    }

    $scope.editChannel = function () {
      var scope = $rootScope.$new()
      scope.chatID = $scope.chatID

      $modal.open({
        templateUrl: templateUrl($scope.isMegagroup ? 'megagroup_edit_modal' : 'channel_edit_modal'),
        controller: 'ChannelEditModalController',
        scope: scope,
        windowClass: 'md_simple_modal_window mobile_modal'
      })
    }

    $scope.goToHistory = function () {
      $rootScope.$broadcast('history_focus', {peerString: $scope.chatFull.peerString})
    }

    $scope.hasRights = function (action) {
      return AppChatsManager.hasRights($scope.chatID, action)
    }
  }
    
})()
