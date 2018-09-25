(function () {
  'use strict'
  angular
    .module('import-contact-modal.controller', ['myApp.i18n'])
    .controller('ImportContactModalController', ImportContactModalController)

  function ImportContactModalController ( $scope, $modalInstance, $rootScope, AppUsersManager, ErrorService, PhonebookContactsService ) {
    if ($scope.importContact === undefined) {
      $scope.importContact = {}
    }
  
    $scope.phonebookAvailable = PhonebookContactsService.isAvailable()

    $scope.doImport = function () {
      if ($scope.importContact && $scope.importContact.phone) {
        $scope.progress = {enabled: true}
        AppUsersManager.importContact(
          $scope.importContact.phone,
          $scope.importContact.first_name || '',
          $scope.importContact.last_name || ''
        ).then(function (foundUserID) {
          if (!foundUserID) {
            ErrorService.show({
              error: {code: 404, type: 'USER_NOT_USING_TELEGRAM'}
            })
          }
          $modalInstance.close(foundUserID)
        })['finally'](function () {
          delete $scope.progress.enabled
        })
      }
    }
  
    $scope.importPhonebook = function () {
      PhonebookContactsService.openPhonebookImport().result.then(function (foundContacts) {
        if (foundContacts) {
          $modalInstance.close(foundContacts[0])
        } else {
          $modalInstance.dismiss()
        }
      })
    }
  }

})()
