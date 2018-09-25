(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('AppLangSelectController', AppLangSelectController)

    function AppLangSelectController ( $scope, _, Storage, ErrorService, AppRuntimeManager ) {
        scope.supportedLocales = Config.I18n.supported
        $scope.langNames = Config.I18n.languages
        $scope.curLocale = Config.I18n.locale
        $scope.form = {locale: Config.I18n.locale}

        $scope.localeSelect = function localeSelect (newLocale) {
            newLocale = newLocale || $scope.form.locale
            if ($scope.curLocale !== newLocale) {
                ErrorService.confirm({type: 'APPLY_LANG_WITH_RELOAD'}).then(function () {
                    Storage.set({i18n_locale: newLocale}).then(function () {
                        AppRuntimeManager.reload()
                    })
                }, function () {
                    $scope.form.locale = $scope.curLocale
                })
            }
        }
    }

})()
