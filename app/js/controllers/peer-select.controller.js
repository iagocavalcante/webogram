(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('PeerSelectController', PeerSelectController)

    function PeerSelectController ( $scope, $modalInstance, $q, AppPeersManager, ErrorService ) {
        $scope.selectedPeers = {}
        $scope.selectedPeerIDs = []
        $scope.selectedCount = 0
    
        if ($scope.shareLinkPromise) {
          $scope.shareLink = {loading: true}
          $scope.shareLinkPromise.then(function (url) {
            $scope.shareLink = {url: url}
          }, function () {
            delete $scope.shareLink
          })
        }
    
        $scope.dialogMultiSelect = function(peerString, event) {
          var peerID = AppPeersManager.getPeerID(peerString)      
          $scope.multiSelect = $scope.selectedPeers[peerID] == undefined || 
            $scope.selectedPeers[peerID] != undefined && Object.keys($scope.selectedPeers).length > 1
          if ($scope.selectedPeers[peerID]) {
            delete $scope.selectedPeers[peerID]
            $scope.selectedCount--
            var pos = $scope.selectedPeerIDs.indexOf(peerID)
            if (pos >= 0) {
              $scope.selectedPeerIDs.splice(pos, 1)
            }
          } else {
            $scope.selectedPeers[peerID] = AppPeersManager.getPeer(peerID)
            $scope.selectedCount++
            $scope.selectedPeerIDs.unshift(peerID)
          }
          cancelEvent(event)
        }
    
        $scope.isSelected = function(peerString){
          var peerID = AppPeersManager.getPeerID(peerString)
          return $scope.selectedPeers[peerID] != undefined
        }
    
        $scope.dialogSelect = function (peerString) {
          var peerID
          if (!$scope.multiSelect) {
            var promise
            if ($scope.confirm_type) {
              peerID = AppPeersManager.getPeerID(peerString)
              var peerData = AppPeersManager.getPeer(peerID)
              promise = ErrorService.confirm({
                type: $scope.confirm_type,
                peer_id: peerID,
                peer_data: peerData
              })
            } else {
              promise = $q.when()
            }
            promise.then(function () {
              $modalInstance.close(peerString)
            })
            return
          }
    
          peerID = AppPeersManager.getPeerID(peerString)
          if ($scope.selectedPeers[peerID]) {
            delete $scope.selectedPeers[peerID]
            $scope.selectedCount--
            var pos = $scope.selectedPeerIDs.indexOf(peerID)
            if (pos >= 0) {
              $scope.selectedPeerIDs.splice(pos, 1)
            }
          } else {
            $scope.selectedPeers[peerID] = AppPeersManager.getPeer(peerID)
            $scope.selectedCount++
            $scope.selectedPeerIDs.unshift(peerID)
          }
        }
    
        $scope.submitSelected = function () {
          if ($scope.selectedCount > 0) {
            var selectedPeerStrings = []
            angular.forEach($scope.selectedPeers, function (t, peerID) {
              selectedPeerStrings.push(AppPeersManager.getPeerString(peerID))
            })
            return $modalInstance.close(selectedPeerStrings)
          }
        }
    
        $scope.toggleSearch = function () {
          $scope.$broadcast('dialogs_search_toggle')
        }
    }

})()
