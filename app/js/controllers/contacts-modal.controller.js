(function () {
  'use strict'
  angular
    .module('contacts-modal.controller', ['myApp.i18n'])
    .controller('ContactsModalController', ContactsModalController)

  function ContactsModalController ( $scope, $rootScope, $timeout, $modal, $modalInstance, MtpApiManager, AppPeersManager, AppUsersManager, ErrorService ) {
    $scope.contacts = []
    $scope.foundPeers = []
    $scope.search = {}
    $scope.slice = {limit: 20, limitDelta: 20}

    var jump = 0
    var i

    resetSelected()
    $scope.disabledContacts = {}

    if ($scope.disabled) {
      for (i = 0; i < $scope.disabled.length; i++) {
        $scope.disabledContacts[$scope.disabled[i]] = true
      }
    }

    if ($scope.selected) {
      for (i = 0; i < $scope.selected.length; i++) {
        if (!$scope.selectedContacts[$scope.selected[i]]) {
          $scope.selectedContacts[$scope.selected[i]] = true
          $scope.selectedCount++
        }
      }
    }

    function resetSelected () {
      $scope.selectedContacts = {}
      $scope.selectedCount = 0
    }

    function updateContacts (query) {
      var curJump = ++jump
      var doneIDs = []
      AppUsersManager.getContacts(query).then(function (contactsList) {
        if (curJump != jump) return
        $scope.contacts = []
        $scope.slice.limit = 20

        angular.forEach(contactsList, function (userID) {
          var contact = {
            userID: userID,
            user: AppUsersManager.getUser(userID)
          }
          doneIDs.push(userID)
          $scope.contacts.push(contact)
        })
        $scope.contactsEmpty = query ? false : !$scope.contacts.length
        $scope.$broadcast('contacts_change')
      })

      if (query && query.length >= 2) {
        $timeout(function () {
          if (curJump != jump) return
          MtpApiManager.invokeApi('contacts.search', {q: query, limit: 10}).then(function (result) {
            AppUsersManager.saveApiUsers(result.users)
            if (curJump != jump) return
            var myPeersLen = result.my_results.length
            var foundPeers = result.my_results.concat(result.results)
            angular.forEach(foundPeers, function (peerFound, i) {
              var peerID = AppPeersManager.getPeerID(peerFound)
              if (peerID <= 0 ||
                  doneIDs.indexOf(peerID) != -1) {
                return
              }
              $scope.contacts.push({
                userID: peerID,
                user: AppUsersManager.getUser(peerID),
                peerString: AppUsersManager.getUserString(peerID),
                found: i >= myPeersLen
              })
            })
          }, function (error) {
            if (error.code == 400) {
              error.handled = true
            }
          })
        }, 500)
      }
    }

    $scope.$watch('search.query', updateContacts)
    $scope.$on('contacts_update', function () {
      updateContacts(($scope.search && $scope.search.query) || '')
    })

    $scope.toggleEdit = function (enabled) {
      $scope.action = enabled ? 'edit' : ''
      $scope.multiSelect = enabled
      resetSelected()
    }

    $scope.contactSelect = function (userID) {
      if ($scope.disabledContacts[userID]) {
        return false
      }
      if (!$scope.multiSelect) {
        return $modalInstance.close(userID)
      }
      if ($scope.selectedContacts[userID]) {
        delete $scope.selectedContacts[userID]
        $scope.selectedCount--
      } else {
        $scope.selectedContacts[userID] = true
        $scope.selectedCount++
      }
    }

    $scope.submitSelected = function () {
      if ($scope.selectedCount > 0) {
        var selectedUserIDs = []
        angular.forEach($scope.selectedContacts, function (t, userID) {
          selectedUserIDs.push(userID)
        })
        return $modalInstance.close(selectedUserIDs)
      }
    }

    $scope.deleteSelected = function () {
      if ($scope.selectedCount > 0) {
        var selectedUserIDs = []
        angular.forEach($scope.selectedContacts, function (t, userID) {
          selectedUserIDs.push(userID)
        })
        AppUsersManager.deleteContacts(selectedUserIDs).then(function () {
          $scope.toggleEdit(false)
        })
      }
    }

    $scope.importContact = function () {
      AppUsersManager.openImportContact().then(function (foundContact) {
        if (foundContact) {
          $rootScope.$broadcast('history_focus', {
            peerString: AppUsersManager.getUserString(foundContact)
          })
        }
      })
    }
  }

})()
