(function () {
    'use strict'
    angular
        .module('welcome.controller', ['myApp.i18n'])
        .controller('AppWelcomeController', AppWelcomeController)
    
    function AppWelcomeController ( $scope, $location, MtpApiManager, ChangelogNotifyService, LayoutSwitchService ) {
        MtpApiManager.getUserID().then(function (id) {
            if (id) {
              $location.url('/im')
              return
            }
            if (location.protocol == 'http:' &&
              !Config.Modes.http &&
              Config.App.domains.indexOf(location.hostname) != -1) {
              location.href = location.href.replace(/^http:/, 'https:')
              return
            }
            $location.url('/login')
          })
      
        ChangelogNotifyService.checkUpdate()
        LayoutSwitchService.start()
    }
})()