(function () {
  'use strict'
  angular
    .module('game-modal.controller', ['myApp.i18n'])
    .controller('GameModalController', GameModalController)

  function GameModalController () {
    $scope.game = AppGamesManager.wrapForFull($scope.gameID, $scope.messageID, $scope.embedUrl)
    var messageID = $scope.messageID

    var message = AppMessagesManager.getMessage(messageID)
    $scope.botID = message.viaBotID || message.fromID

    $scope.nav = {}

    $scope.forward = function (withMyScore) {
      PeersSelectService.selectPeer({canSend: true, confirm_type: 'INVITE_TO_GAME'}).then(function (peerString) {
        var peerID = AppPeersManager.getPeerID(peerString)
        AppMessagesManager.forwardMessages(peerID, [messageID], {
          withMyScore: withMyScore
        }).then(function () {
          $rootScope.$broadcast('history_focus', {
            peerString: peerString
          })
        })
      })
    }

    $scope.$on('game_frame_event', function (e, eventData) {
      if (eventData.eventType == 'share_score') {
        $scope.forward(true)
      }
    })
  }
    
})()
