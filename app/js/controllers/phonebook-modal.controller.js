(function () {
  'use strict'
  angular
    .module('phonebook-modal.controller', ['myApp.i18n'])
    .controller('PhonebookModalController', PhonebookModalController)

  function PhonebookModalController ( $scope, $modalInstance, $rootScope, AppUsersManager, PhonebookContactsService, ErrorService ) {
    $scope.search = {}
    $scope.phonebook = []
    $scope.selectedContacts = {}
    $scope.selectedCount = 0
    $scope.slice = {limit: 20, limitDelta: 20}
    $scope.progress = {enabled: false}
    $scope.multiSelect = true

    var searchIndex = SearchIndexManager.createIndex()
    var phonebookReady = false

    PhonebookContactsService.getPhonebookContacts().then(function (phonebook) {
      for (var i = 0; i < phonebook.length; i++) {
        SearchIndexManager.indexObject(i, phonebook[i].first_name + ' ' + phonebook[i].last_name + ' ' + phonebook[i].phones.join(' '), searchIndex)
      }
      $scope.phonebook = phonebook
      $scope.toggleSelection(true)
      phonebookReady = true
      updateList()
    }, function (error) {
      ErrorService.show({
        error: {code: 403, type: 'PHONEBOOK_GET_CONTACTS_FAILED', originalError: error}
      })
    })

    function updateList () {
      var filtered = false
      var results = {}

      if (angular.isString($scope.search.query) && $scope.search.query.length) {
        filtered = true
        results = SearchIndexManager.search($scope.search.query, searchIndex)

        $scope.contacts = []
        delete $scope.contactsEmpty
        for (var i = 0; i < $scope.phonebook.length; i++) {
          if (!filtered || results[i]) {
            $scope.contacts.push($scope.phonebook[i])
          }
        }
      } else {
        $scope.contacts = $scope.phonebook
        $scope.contactsEmpty = !$scope.contacts.length
      }

      $scope.slice.limit = 20
    }

    $scope.$watch('search.query', function (newValue) {
      if (phonebookReady) {
        updateList()
      }
    })

    $scope.contactSelect = function (i) {
      if (!$scope.multiSelect) {
        return $modalInstance.close($scope.phonebook[i])
      }
      if ($scope.selectedContacts[i]) {
        delete $scope.selectedContacts[i]
        $scope.selectedCount--
      } else {
        $scope.selectedContacts[i] = true
        $scope.selectedCount++
      }
    }

    $scope.toggleSelection = function (fill) {
      if (!$scope.selectedCount || fill) {
        $scope.selectedCount = $scope.phonebook.length
        for (var i = 0; i < $scope.phonebook.length; i++) {
          $scope.selectedContacts[i] = true
        }
      } else {
        $scope.selectedCount = 0
        $scope.selectedContacts = {}
      }
    }

    $scope.submitSelected = function () {
      if ($scope.selectedCount <= 0) {
        $modalInstance.dismiss()
      }

      var selectedContacts = []
      angular.forEach($scope.selectedContacts, function (t, i) {
        selectedContacts.push($scope.phonebook[i])
      })

      ErrorService.confirm({
        type: 'CONTACTS_IMPORT_PERFORM'
      }).then(function () {
        $scope.progress.enabled = true
        AppUsersManager.importContacts(selectedContacts).then(function (foundContacts) {
          if (!foundContacts.length) {
            ErrorService.show({
              error: {code: 404, type: 'USERS_NOT_USING_TELEGRAM'}
            })
          }
          $modalInstance.close(foundContacts)
        })['finally'](function () {
          $scope.progress.enabled = false
        })
      })
    }
  }

})()
