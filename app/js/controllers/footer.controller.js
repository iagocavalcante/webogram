(function () {
	'use strict'
	angular
		.module('app-footer.controller', ['myApp.i18n'])
		.controller('AppFooterController', AppFooterController)
    
	function AppFooterController ( $scope, LayoutSwitchService ) {
		$scope.switchLayout = function (mobile) {
				LayoutSwitchService.switchLayout(mobile)
		}
	}

})()
