(function () {
  'use strict'
  angular
    .module('video-modal.controller', ['myApp.i18n'])
    .controller('VideoModalController', VideoModalController)

  function VideoModalController () {
    $scope.video = AppDocsManager.wrapVideoForFull($scope.docID)

    $scope.progress = {enabled: false}
    $scope.player = {}

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

    $scope.download = function () {
      AppDocsManager.saveDocFile($scope.docID)
    }

    $scope.$on('history_delete', function (e, historyUpdate) {
      if (historyUpdate && historyUpdate.msgs && historyUpdate.msgs[$scope.messageID]) {
        $modalInstance.dismiss()
      }
    })
  }

})()
