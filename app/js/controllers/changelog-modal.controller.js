(function () {
	'use strict'
	angular
		.module('changelog-modal.controller', ['myApp.i18n'])
		.controller('ChangelogModalController', ChangelogModalController)

	function ChangelogModalController( $scope, $modal ) {
		$scope.currentVersion = Config.App.version
		if (!$scope.lastVersion) {
				var versionParts = $scope.currentVersion.split('.')
				$scope.lastVersion = versionParts[0] + '.' + versionParts[1] + '.' + Math.max(0, versionParts[2] - 1)
		}

		$scope.changelogHidden = false
		$scope.changelogShown = false

		$scope.canShowVersion = function (curVersion) {
				if ($scope.changelogShown) {
						return true
				}

				var show = versionCompare(curVersion, $scope.lastVersion) >= 0
				if (!show) {
						$scope.changelogHidden = true
				}

				return show
		}

		$scope.showAllVersions = function () {
				$scope.changelogShown = true
				$scope.changelogHidden = false
				$scope.$emit('ui_height')
				$scope.$broadcast('ui_height')
		}

		$scope.changeUsername = function () {
				$modal.open({
						templateUrl: templateUrl('username_edit_modal'),
						controller: 'UsernameEditModalController',
						windowClass: 'md_simple_modal_window mobile_modal'
				})
		}
	}

})()
