(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('UsernameEditModalController', UsernameEditModalController)

    function UsernameEditModalController ( $scope, $modalInstance, AppUsersManager, MtpApiManager ) {
        $scope.profile = {}
        $scope.error = {}
    
        MtpApiManager.getUserID().then(function (id) {
          var user = AppUsersManager.getUser(id)
          $scope.profile = {
            username: user.username
          }
        })
    
        $scope.updateUsername = function () {
          $scope.profile.updating = true
    
          MtpApiManager.invokeApi('account.updateUsername', {
            username: $scope.profile.username || ''
          }).then(function (user) {
            $scope.checked = {}
            AppUsersManager.saveApiUser(user)
            $modalInstance.close()
          }, function (error) {
            switch (error.type) {
              case 'USERNAME_NOT_MODIFIED':
                error.handled = true
                $modalInstance.close()
                break
            }
          })['finally'](function () {
            delete $scope.profile.updating
          })
        }
    
        $scope.$watch('profile.username', function (newVal) {
          if (!newVal || !newVal.length) {
            $scope.checked = {}
            return
          }
          MtpApiManager.invokeApi('account.checkUsername', {
            username: newVal
          }).then(function (valid) {
            if ($scope.profile.username !== newVal) {
              return
            }
            if (valid) {
              $scope.checked = {success: true}
            } else {
              $scope.checked = {error: true}
            }
          }, function (error) {
            if ($scope.profile.username !== newVal) {
              return
            }
            switch (error.type) {
              case 'USERNAME_INVALID':
                $scope.checked = {error: true}
                error.handled = true
                break
            }
          })
        })
    }

})()
