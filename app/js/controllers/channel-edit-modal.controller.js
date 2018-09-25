(function () {
    'use strict'
  angular
    .module('channel-edit-modal.controller', ['myApp.i18n'])
    .controller('ChannelEditModalController', ChannelEditModalController)
    
  function ChannelEditModalController ( $q, $scope, $modalInstance, $rootScope, MtpApiManager, AppUsersManager, AppChatsManager, AppProfileManager, ApiUpdatesManager ) {
    var channel = AppChatsManager.getChat($scope.chatID)
    var initial = {title: channel.title}
    $scope.channel = {title: channel.title}

    AppProfileManager.getChannelFull($scope.chatID).then(function (channelFull) {
      initial.about = channelFull.about
      $scope.channel.about = channelFull.about
    })

    $scope.updateChannel = function () {
      if (!$scope.channel.title.length) {
        return
      }
      var promises = []
      if ($scope.channel.title != initial.title) {
        promises.push(editTitle())
      }
      if ($scope.channel.about != initial.about) {
        promises.push(editAbout())
      }

      $scope.channel.updating = true
      return $q.all(promises).then(function () {
        var peerString = AppChatsManager.getChatString($scope.chatID)
        $rootScope.$broadcast('history_focus', {peerString: peerString})
      })['finally'](function () {
        delete $scope.channel.updating
      })
    }

    function editTitle () {
      return MtpApiManager.invokeApi('channels.editTitle', {
        channel: AppChatsManager.getChannelInput($scope.chatID),
        title: $scope.channel.title
      }).then(function (updates) {
        ApiUpdatesManager.processUpdateMessage(updates)
      })
    }

    function editAbout () {
      return MtpApiManager.invokeApi('channels.editAbout', {
        channel: AppChatsManager.getChannelInput($scope.chatID),
        about: $scope.channel.about
      })
    }
  }

})()
