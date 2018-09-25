(function () {
  'use strict'
  angular
    .module('chat-create-modal.controller', ['myApp.i18n'])
    .controller('ChatCreateModalController', ChatCreateModalController)

  function ChatCreateModalController ( $scope, $modalInstance, $rootScope, MtpApiManager, AppUsersManager, AppChatsManager, ApiUpdatesManager ) {
    $scope.group = {name: ''}

    $scope.createGroup = function () {
      if (!$scope.group.name) {
        return
      }
      $scope.group.creating = true
      var inputUsers = []
      angular.forEach($scope.userIDs, function (userID) {
        inputUsers.push(AppUsersManager.getUserInput(userID))
      })
      return MtpApiManager.invokeApi('messages.createChat', {
        title: $scope.group.name,
        users: inputUsers
      }).then(function (updates) {
        ApiUpdatesManager.processUpdateMessage(updates)

        if (updates.updates && updates.updates.length) {
          for (var i = 0, len = updates.updates.length, update; i < len; i++) {
            update = updates.updates[i]
            if (update._ == 'updateNewMessage') {
              $rootScope.$broadcast('history_focus', {peerString: AppChatsManager.getChatString(update.message.to_id.chat_id)
              })
              break
            }
          }
          $modalInstance.close()
        }
      })['finally'](function () {
        delete $scope.group.creating
      })
    }
  }

})()
