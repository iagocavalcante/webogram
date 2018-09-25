(function () {
  'use strict'
  angular
    .module('embed-modal.controller', ['myApp.i18n'])
    .controller('EmbedModalController', EmbedModalController)
    
  function EmbedModalController ( $q, $scope, $rootScope, $modalInstance, AppPhotosManager, AppMessagesManager, AppPeersManager, AppWebPagesManager, PeersSelectService, ErrorService ) {
    $scope.webpage = AppWebPagesManager.wrapForFull($scope.webpageID)

    $scope.nav = {}

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

    $scope['delete'] = function () {
      var messageID = $scope.messageID
      ErrorService.confirm({type: 'MESSAGE_DELETE'}).then(function () {
        AppMessagesManager.deleteMessages([messageID])
      })
    }
  }

})()
