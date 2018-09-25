(function () {
  'use strict'
  angular
    .module('country-select-modal.controller', ['myApp.i18n'])
    .controller('CountrySelectModalController', CountrySelectModalController)

  function CountrySelectModalController ( $scope, $modalInstance, $rootScope, _ ) {
    $scope.search = {}
    $scope.slice = {limit: 20, limitDelta: 20}

    var searchIndex = SearchIndexManager.createIndex()

    for (var i = 0; i < Config.CountryCodes.length; i++) {
      var searchString = Config.CountryCodes[i][0]
      searchString += ' ' + _(Config.CountryCodes[i][1] + '_raw')
      searchString += ' ' + Config.CountryCodes[i].slice(2).join(' ')
      SearchIndexManager.indexObject(i, searchString, searchIndex)
    }

    $scope.$watch('search.query', function (newValue) {
      var filtered = false
      var results = {}

      if (angular.isString(newValue) && newValue.length) {
        filtered = true
        results = SearchIndexManager.search(newValue, searchIndex)
      }

      $scope.countries = []
      $scope.slice.limit = 20

      var j
      for (var i = 0; i < Config.CountryCodes.length; i++) {
        if (!filtered || results[i]) {
          for (j = 2; j < Config.CountryCodes[i].length; j++) {
            $scope.countries.push({name: _(Config.CountryCodes[i][1] + '_raw'), code: Config.CountryCodes[i][j]})
          }
        }
      }
      if (String.prototype.localeCompare) {
        $scope.countries.sort(function (a, b) {
          return a.name.localeCompare(b.name)
        })
      }
    })
  }
    
})()
