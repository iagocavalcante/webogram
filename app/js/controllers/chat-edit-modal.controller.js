(function () {
  'use strict'
  angular
    .module('chat-edit-modal.controller', ['myApp.i18n'])
    .controller('ChatEditModalController', ChatEditModalController)

  function ChatEditModalController ( $scope, $modalInstance, $rootScope, MtpApiManager, AppUsersManager, AppChatsManager, ApiUpdatesManager ) {
    var chat = AppChatsManager.getChat($scope.chatID)
    $scope.group = {name: chat.title}

    $scope.updateGroup = function () {
      if (!$scope.group.name) {
        return
      }
      if ($scope.group.name == chat.title) {
        return $modalInstance.close()
      }

      $scope.group.updating = true

      var apiPromise
      if (AppChatsManager.isChannel($scope.chatID)) {
        apiPromise = MtpApiManager.invokeApi('channels.editTitle', {
          channel: AppChatsManager.getChannelInput($scope.chatID),
          title: $scope.group.name
        })
      } else {
        apiPromise = MtpApiManager.invokeApi('messages.editChatTitle', {
          chat_id: AppChatsManager.getChatInput($scope.chatID),
          title: $scope.group.name
        })
      }

      return apiPromise.then(function (updates) {
        ApiUpdatesManager.processUpdateMessage(updates)
        var peerString = AppChatsManager.getChatString($scope.chatID)
        $rootScope.$broadcast('history_focus', {peerString: peerString})
      })['finally'](function () {
        delete $scope.group.updating
      })
    }
  }

})()
