(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('SessionsListModalController', SessionsListModalController)

    function SessionsListModalController ( $scope, $q, $timeout, _, MtpApiManager, ErrorService, $modalInstance ) {
        $scope.slice = {limit: 20, limitDelta: 20}

        var updateSessionsTimeout = false
        var stopped = false
    
        function updateSessions () {
          $timeout.cancel(updateSessionsTimeout)
          MtpApiManager.invokeApi('account.getAuthorizations').then(function (result) {
            $scope.sessionsLoaded = true
            $scope.authorizations = result.authorizations
    
            var authorization
            for (var i = 0, len = $scope.authorizations.length; i < len; i++) {
              authorization = $scope.authorizations[i]
              authorization.current = (authorization.flags & 1) == 1
            }
            $scope.authorizations.sort(function (sA, sB) {
              if (sA.current) {
                return -1
              }
              if (sB.current) {
                return 1
              }
              return sB.date_active - sA.date_active
            })
            if (!stopped) {
              updateSessionsTimeout = $timeout(updateSessions, 5000)
            }
          })
        }
    
        $scope.terminateSession = function (hash) {
          ErrorService.confirm({type: 'TERMINATE_SESSION'}).then(function () {
            MtpApiManager.invokeApi('account.resetAuthorization', {hash: hash}).then(updateSessions)
          })
        }
    
        $scope.terminateAllSessions = function () {
          ErrorService.confirm({type: 'TERMINATE_SESSIONS'}).then(function () {
            MtpApiManager.invokeApi('auth.resetAuthorizations', {})
          })
        }
    
        updateSessions()
    
        $scope.$on('apiUpdate', function (e, update) {
          if (update._ == 'updateNewAuthorization') {
            updateSessions()
          }
        })
    
        $scope.$on('$destroy', function () {
          $timeout.cancel(updateSessionsTimeout)
          stopped = true
        })
    }

})()
