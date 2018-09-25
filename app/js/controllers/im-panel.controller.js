(function () {
	'use strict'
	angular
		.module('im-panel.controller', ['myApp.i18n'])
		.controller('AppImPanelController', AppImPanelController)

	function AppImPanelController ( $scope ) {
		$scope.$on('user_update', angular.noop)
	}
    
})()
