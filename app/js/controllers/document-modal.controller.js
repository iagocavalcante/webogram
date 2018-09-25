(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('DocumentModalController', DocumentModalController)

    function DocumentModalController ( $scope, $rootScope, $modalInstance, PeersSelectService, AppMessagesManager, AppDocsManager, AppPeersManager, ErrorService ) {
        $scope.document = AppDocsManager.wrapForHistory($scope.docID)

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
