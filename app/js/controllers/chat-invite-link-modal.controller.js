(function () {
  'use strict'
  angular
    .module('chat-invite-link-modal.controller', ['myApp.i18n'])
    .controller('ChatInviteLinkModalController', ChatInviteLinkModalController)

  function ChatInviteLinkModalController ( _, $scope, $timeout, $modalInstance, AppChatsManager, AppProfileManager, ErrorService ) {
    $scope.exportedInvite = {link: _('group_invite_link_loading_raw')}

    var isChannel = AppChatsManager.isChannel($scope.chatID)
    var isMegagroup = AppChatsManager.isMegagroup($scope.chatID)

    function selectLink () {
      $timeout(function () {
        $scope.$broadcast('ui_invite_select')
      }, 100)
    }

    function updateLink (force) {
      var chat = AppChatsManager.getChat($scope.chatID)
      if (chat.username) {
        $scope.exportedInvite = {link: 'https://t.me/' + chat.username, short: true}
        selectLink()
        return
      }
      if (force) {
        $scope.exportedInvite.revoking = true
      }
      AppProfileManager.getChatInviteLink($scope.chatID, force).then(function (link) {
        $scope.exportedInvite = {link: link, canRevoke: true}
        selectLink()
      })['finally'](function () {
        delete $scope.exportedInvite.revoking
      })
    }

    $scope.revokeLink = function () {
      ErrorService.confirm({
        type: isChannel && !isMegagroup ? 'REVOKE_CHANNEL_INVITE_LINK' : 'REVOKE_GROUP_INVITE_LINK'
      }).then(function () {
        updateLink(true)
      })
    }

    updateLink()
  }

})()
