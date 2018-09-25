(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('AppFooterController', AppFooterController)
    
    function AppFooterController ( $scope, LayoutSwitchService ) {
        $scope.switchLayout = function (mobile) {
            LayoutSwitchService.switchLayout(mobile)
        }
    }

})()
