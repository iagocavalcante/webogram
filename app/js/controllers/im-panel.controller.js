(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('AppImPanelController', AppImPanelController)

    function AppImPanelController ( $scope ) {
        $scope.$on('user_update', angular.noop)
    }
    
})()
