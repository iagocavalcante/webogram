(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('PasswordRecoveryModalController', PasswordRecoveryModalController)
    
    function PasswordRecoveryModalController ( $scope, $q, _, PasswordManager, MtpApiManager, ErrorService, $modalInstance ) {
        $scope.checkCode = function () {
            $scope.recovery.updating = true
      
            PasswordManager.recover($scope.recovery.code, $scope.options).then(function (result) {
              ErrorService.alert(
                _('error_modal_password_disabled_title_raw'),
                _('error_modal_password_disabled_descripion_raw')
              )
              $modalInstance.close(result)
            }, function (error) {
              delete $scope.recovery.updating
              switch (error.type) {
                case 'CODE_EMPTY':
                case 'CODE_INVALID':
                  $scope.recovery.error_field = 'code'
                  error.handled = true
                  break
      
                case 'PASSWORD_EMPTY':
                case 'PASSWORD_RECOVERY_NA':
                case 'PASSWORD_RECOVERY_EXPIRED':
                  $modalInstance.dismiss()
                  error.handled = true
                  break
              }
            })
          }
    }

})()
