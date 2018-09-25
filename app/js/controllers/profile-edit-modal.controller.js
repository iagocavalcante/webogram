(function () {
  'use strict'
  angular
    .module('profile-edit-modal.controller', ['myApp.i18n'])
    .controller('ProfileEditModalController', ProfileEditModalController)
    
  function ProfileEditModalController ( $scope, $modalInstance, AppUsersManager, MtpApiManager ) {
    $scope.profile = {}
    $scope.error = {}

    MtpApiManager.getUserID().then(function (id) {
      var user = AppUsersManager.getUser(id)
      $scope.profile = {
        first_name: user.first_name,
        last_name: user.last_name
      }
    })

    $scope.updateProfile = function () {
      $scope.profile.updating = true
      var flags = (1 << 0) | (1 << 1)
      MtpApiManager.invokeApi('account.updateProfile', {
        flags: flags,
        first_name: $scope.profile.first_name || '',
        last_name: $scope.profile.last_name || ''
      }).then(function (user) {
        $scope.error = {}
        AppUsersManager.saveApiUser(user)
        $modalInstance.close()
      }, function (error) {
        switch (error.type) {
          case 'FIRSTNAME_INVALID':
            $scope.error = {field: 'first_name'}
            error.handled = true
            break

          case 'LASTNAME_INVALID':
            $scope.error = {field: 'last_name'}
            error.handled = true
            break

          case 'NAME_NOT_MODIFIED':
            error.handled = true
            $modalInstance.close()
            break
        }
      })['finally'](function () {
        delete $scope.profile.updating
      })
    }
  }

})()
