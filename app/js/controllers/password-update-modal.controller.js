(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('PasswordUpdateModalController', PasswordUpdateModalController)

    function PasswordUpdateModalController ( $scope, $q, _, PasswordManager, MtpApiManager, ErrorService, $modalInstance ) {
        $scope.passwordSettings = {}

        $scope.updatePassword = function () {
          delete $scope.passwordSettings.error_field
    
          var confirmPromise
          if ($scope.action == 'disable') {
            confirmPromise = $q.when()
          } else {
            if (!$scope.passwordSettings.new_password) {
              $scope.passwordSettings.error_field = 'new_password'
              $scope.$broadcast('new_password_focus')
              return false
            }
            if ($scope.passwordSettings.new_password != $scope.passwordSettings.confirm_password) {
              $scope.passwordSettings.error_field = 'confirm_password'
              $scope.$broadcast('confirm_password_focus')
              return false
            }
            confirmPromise = $scope.passwordSettings.email
              ? $q.when()
              : ErrorService.confirm({type: 'RECOVERY_EMAIL_EMPTY'})
          }
    
          $scope.passwordSettings.loading = true
    
          confirmPromise.then(function () {
            PasswordManager.updateSettings($scope.password, {
              cur_password: $scope.passwordSettings.cur_password || '',
              new_password: $scope.passwordSettings.new_password,
              email: $scope.passwordSettings.email,
              hint: $scope.passwordSettings.hint
            }).then(function (result) {
              delete $scope.passwordSettings.loading
              $modalInstance.close(true)
              if ($scope.action == 'disable') {
                ErrorService.alert(
                  _('error_modal_password_disabled_title_raw'),
                  _('error_modal_password_disabled_descripion_raw')
                )
              } else {
                ErrorService.alert(
                  _('error_modal_password_success_title_raw'),
                  _('error_modal_password_success_descripion_raw')
                )
              }
            }, function (error) {
              switch (error.type) {
                case 'PASSWORD_HASH_INVALID':
                case 'NEW_PASSWORD_BAD':
                  $scope.passwordSettings.error_field = 'cur_password'
                  error.handled = true
                  $scope.$broadcast('cur_password_focus')
                  break
                case 'NEW_PASSWORD_BAD':
                  $scope.passwordSettings.error_field = 'new_password'
                  error.handled = true
                  break
                case 'EMAIL_INVALID':
                  $scope.passwordSettings.error_field = 'email'
                  error.handled = true
                  break
                case 'EMAIL_UNCONFIRMED':
                  ErrorService.alert(
                    _('error_modal_email_unconfirmed_title_raw'),
                    _('error_modal_email_unconfirmed_descripion_raw')
                  )
                  $modalInstance.close(true)
                  error.handled = true
                  break
              }
              delete $scope.passwordSettings.loading
            })
          })
        }
    
        switch ($scope.action) {
          case 'disable':
            $scope.passwordSettings.new_password = ''
            break
          case 'create':
            onContentLoaded(function () {
              $scope.$broadcast('new_password_focus')
            })
            break
        }
    
        $scope.$watch('passwordSettings.new_password', function (newValue) {
          var len = (newValue && newValue.length) || 0
          if (!len) {
            $scope.passwordSettings.hint = ''
          } else if (len <= 3) {
            $scope.passwordSettings.hint = '***'
          } else {
            $scope.passwordSettings.hint = newValue.charAt(0) + (new Array(len - 1)).join('*') + newValue.charAt(len - 1)
          }
          $scope.$broadcast('value_updated')
        })
    }

})()
