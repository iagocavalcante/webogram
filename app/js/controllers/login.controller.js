(function () {
  'use strict'
  angular
    .module('app-login.controller', ['myApp.i18n'])
    .controller('AppLoginController', AppLoginController)
    
  function AppLoginController ( $scope, $rootScope, $location, $timeout, $modal, $modalStack, MtpApiManager, ErrorService, NotificationsManager, PasswordManager, ChangelogNotifyService, IdleManager, LayoutSwitchService, WebPushApiManager, TelegramMeWebService, _ ) {
    $modalStack.dismissAll()
    IdleManager.start()

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
      TelegramMeWebService.setAuthorized(false)
      WebPushApiManager.forceUnsubscribe()
    })

    var options = {dcID: 2, createNetworker: true}
    var countryChanged = false
    var selectedCountry = false

    $scope.credentials = {phone_country: '', phone_country_name: '', phone_number: '', phone_full: ''}
    $scope.progress = {}
    $scope.nextPending = {}
    $scope.about = {}

    $scope.chooseCountry = function () {
      var modal = $modal.open({
        templateUrl: templateUrl('country_select_modal'),
        controller: 'CountrySelectModalController',
        windowClass: 'countries_modal_window mobile_modal',
        backdrop: 'single'
      })

      modal.result.then(selectCountry)
    }

    function initPhoneCountry () {
      var langCode = (navigator.language || '').toLowerCase()
      var countryIso2 = Config.LangCountries[langCode]
      var shouldPregenerate = !Config.Navigator.mobile

      if (['en', 'en-us', 'en-uk'].indexOf(langCode) == -1) {
        if (countryIso2 !== undefined) {
          selectPhoneCountryByIso2(countryIso2)
        } else if (langCode.indexOf('-') > 0) {
          selectPhoneCountryByIso2(langCode.split('-')[1].toUpperCase())
        } else {
          selectPhoneCountryByIso2('US')
        }
      } else {
        selectPhoneCountryByIso2('US')
      }

      if (!shouldPregenerate) {
        return
      }
      var wasCountry = $scope.credentials.phone_country
      MtpApiManager.invokeApi('help.getNearestDc', {}, {dcID: 2, createNetworker: true}).then(function (nearestDcResult) {
        if (wasCountry == $scope.credentials.phone_country) {
          selectPhoneCountryByIso2(nearestDcResult.country)
        }
        if (nearestDcResult.nearest_dc != nearestDcResult.this_dc) {
          MtpApiManager.getNetworker(nearestDcResult.nearest_dc, {createNetworker: true})
        }
      })
    }

    function selectPhoneCountryByIso2 (countryIso2) {
      if (countryIso2) {
        var i, country
        for (i = 0; i < Config.CountryCodes.length; i++) {
          country = Config.CountryCodes[i]
          if (country[0] == countryIso2) {
            return selectCountry({name: _(country[1] + '_raw'), code: country[2]})
          }
        }
      }
      return selectCountry({name: _('country_select_modal_country_us_raw'), code: '+1'})
    }

    function selectCountry (country) {
      selectedCountry = country
      if ($scope.credentials.phone_country != country.code) {
        $scope.credentials.phone_country = country.code
      } else {
        updateCountry()
      }
      $scope.$broadcast('country_selected')
      $scope.$broadcast('value_updated')
    }

    function updateCountry () {
      var phoneNumber = (
        ($scope.credentials.phone_country || '') +
        ($scope.credentials.phone_number || '')
          ).replace(/\D+/g, '')
      var i, j, code
      var maxLength = 0
      var maxName = false

      if (phoneNumber.length) {
        if (selectedCountry && !phoneNumber.indexOf(selectedCountry.code.replace(/\D+/g, ''))) {
          maxName = selectedCountry.name
        } else {
          for (i = 0; i < Config.CountryCodes.length; i++) {
            for (j = 2; j < Config.CountryCodes[i].length; j++) {
              code = Config.CountryCodes[i][j].replace(/\D+/g, '')
              if (code.length > maxLength && !phoneNumber.indexOf(code)) {
                maxLength = code.length
                maxName = _(Config.CountryCodes[i][1] + '_raw')
              }
            }
          }
        }
      }

      $scope.credentials.phone_full = phoneNumber
      $scope.credentials.phone_country_name = maxName || _('login_controller_unknown_country_raw')
    }

    $scope.$watch('credentials.phone_country', updateCountry)
    $scope.$watch('credentials.phone_number', updateCountry)
    initPhoneCountry()

    var nextTimeout
    var updatePasswordTimeout = false

    function saveAuth (result) {
      MtpApiManager.setUserAuth(options.dcID, {
        id: result.user.id
      })
      $timeout.cancel(nextTimeout)

      $location.url('/im')
    }

    $scope.sendCode = function () {
      $timeout.cancel(nextTimeout)

      var fullPhone = ($scope.credentials.phone_country || '') + ($scope.credentials.phone_number || '')
      var badPhone = !fullPhone.match(/^[\d\-+\s]+$/)
      if (!badPhone) {
        fullPhone = fullPhone.replace(/\D/g, '')
        if (fullPhone.length < 7) {
          badPhone = true
        }
      }
      if (badPhone) {
        $scope.progress.enabled = false
        $scope.error = {field: 'phone'}
        return
      }

      ErrorService.confirm({
        type: 'LOGIN_PHONE_CORRECT',
        country_code: $scope.credentials.phone_country,
        phone_number: $scope.credentials.phone_number
      }).then(function () {
        $scope.progress.enabled = true

        onContentLoaded(function () {
          $scope.$broadcast('ui_height')
        })

        var authKeyStarted = tsNow()
        MtpApiManager.invokeApi('auth.sendCode', {
          flags: 0,
          phone_number: $scope.credentials.phone_full,
          api_id: Config.App.id,
          api_hash: Config.App.hash,
          lang_code: navigator.language || 'en'
        }, options).then(function (sentCode) {
          $scope.progress.enabled = false

          $scope.error = {}
          $scope.about = {}
          $scope.credentials.phone_code_hash = sentCode.phone_code_hash
          applySentCode(sentCode)
        }, function (error) {
          $scope.progress.enabled = false
          console.log('sendCode error', error)
          switch (error.type) {
            case 'PHONE_NUMBER_INVALID':
              $scope.error = {field: 'phone'}
              error.handled = true
              break

            case 'PHONE_NUMBER_APP_SIGNUP_FORBIDDEN':
              $scope.error = {field: 'phone'}
              break
          }
        })['finally'](function () {
          if ($rootScope.idle.isIDLE || tsNow() - authKeyStarted > 60000) {
            NotificationsManager.notify({
              title: 'Telegram',
              message: 'Your authorization key was successfully generated! Open the app to log in.',
              tag: 'auth_key'
            })
          }
        })
      })
    }

    function applySentCode (sentCode) {
      $scope.credentials.type = sentCode.type
      $scope.nextPending.type = sentCode.next_type || false
      $scope.nextPending.remaining = sentCode.timeout || false
      delete $scope.nextPending.progress

      nextTimeoutCheck()

      onContentLoaded(function () {
        $scope.$broadcast('ui_height')
      })
    }

    $scope.sendNext = function () {
      if (!$scope.nextPending.type ||
        $scope.nextPending.remaining > 0) {
        return
      }
      $scope.nextPending.progress = true
      MtpApiManager.invokeApi('auth.resendCode', {
        phone_number: $scope.credentials.phone_full,
        phone_code_hash: $scope.credentials.phone_code_hash
      }, options).then(applySentCode)
    }

    function nextTimeoutCheck () {
      $timeout.cancel(nextTimeout)
      if (!$scope.nextPending.type ||
        $scope.nextPending.remaining === false) {
        return
      }
      if ((--$scope.nextPending.remaining) > 0) {
        nextTimeout = $timeout(nextTimeoutCheck, 1000)
      }
    }

    $scope.editPhone = function () {
      $timeout.cancel(nextTimeout)

      if ($scope.credentials.phone_full &&
        $scope.credentials.phone_code_hash) {
        MtpApiManager.invokeApi('auth.cancelCode', {
          phone_number: $scope.credentials.phone_full,
          phone_code_hash: $scope.credentials.phone_code_hash
        }, options)
      }

      delete $scope.credentials.phone_code_hash
      delete $scope.credentials.phone_unoccupied
      delete $scope.credentials.phone_code_valid
      delete $scope.nextPending.remaining
    }

    $scope.$watch('credentials.phone_code', function (newVal) {
      if (newVal &&
        newVal.match(/^\d+$/) &&
        $scope.credentials.type &&
        $scope.credentials.type.length &&
        newVal.length == $scope.credentials.type.length) {
        $scope.logIn()
      }
    })

    $scope.logIn = function (forceSignUp) {
      if ($scope.progress.enabled &&
          $scope.progress.forceSignUp == forceSignUp) {
        return
      }
      var method = 'auth.signIn'
      var params = {
        phone_number: $scope.credentials.phone_full,
        phone_code_hash: $scope.credentials.phone_code_hash,
        phone_code: $scope.credentials.phone_code
      }
      if (forceSignUp) {
        method = 'auth.signUp'
        angular.extend(params, {
          first_name: $scope.credentials.first_name || '',
          last_name: $scope.credentials.last_name || ''
        })
      }

      $scope.progress.forceSignUp = forceSignUp
      $scope.progress.enabled = true
      MtpApiManager.invokeApi(method, params, options).then(saveAuth, function (error) {
        $scope.progress.enabled = false
        if (error.code == 400 && error.type == 'PHONE_NUMBER_UNOCCUPIED') {
          error.handled = true
          $scope.credentials.phone_code_valid = true
          $scope.credentials.phone_unoccupied = true
          $scope.about = {}
          return
        } else if (error.code == 400 && error.type == 'PHONE_NUMBER_OCCUPIED') {
          error.handled = true
          return $scope.logIn(false)
        } else if (error.code == 401 && error.type == 'SESSION_PASSWORD_NEEDED') {
          $scope.progress.enabled = true
          updatePasswordState().then(function () {
            $scope.progress.enabled = false
            $scope.credentials.phone_code_valid = true
            $scope.credentials.password_needed = true
            $scope.about = {}
          })
          error.handled = true
          return
        }

        switch (error.type) {
          case 'FIRSTNAME_INVALID':
            $scope.error = {field: 'first_name'}
            error.handled = true
            break
          case 'LASTNAME_INVALID':
            $scope.error = {field: 'last_name'}
            error.handled = true
            break
          case 'PHONE_CODE_INVALID':
            $scope.error = {field: 'phone_code'}
            delete $scope.credentials.phone_code_valid
            error.handled = true
            break
          case 'PHONE_CODE_EXPIRED':
            $scope.editPhone()
            error.handled = true
            break
        }
      })
    }

    $scope.checkPassword = function () {
      $scope.progress.enabled = true
      return PasswordManager.check($scope.password, $scope.credentials.password, options).then(saveAuth, function (error) {
        $scope.progress.enabled = false
        switch (error.type) {
          case 'PASSWORD_HASH_INVALID':
            $scope.error = {field: 'password'}
            error.handled = true
            break
        }
      })
    }

    $scope.forgotPassword = function (event) {
      PasswordManager.requestRecovery($scope.password, options).then(function (emailRecovery) {
        var scope = $rootScope.$new()
        scope.recovery = emailRecovery
        scope.options = options
        var modal = $modal.open({
          scope: scope,
          templateUrl: templateUrl('password_recovery_modal'),
          controller: 'PasswordRecoveryModalController',
          windowClass: 'md_simple_modal_window mobile_modal'
        })

        modal.result.then(function (result) {
          if (result && result.user) {
            saveAuth(result)
          } else {
            $scope.canReset = true
          }
        })
      }, function (error) {
        switch (error.type) {
          case 'PASSWORD_EMPTY':
            $scope.logIn()
            error.handled = true
            break
          case 'PASSWORD_RECOVERY_NA':
            $timeout(function () {
              $scope.canReset = true
            }, 1000)
            error.handled = true
            break
        }
      })

      return cancelEvent(event)
    }

    $scope.resetAccount = function () {
      ErrorService.confirm({
        type: 'RESET_ACCOUNT'
      }).then(function () {
        $scope.progress.enabled = true
        MtpApiManager.invokeApi('account.deleteAccount', {
          reason: 'Forgot password'
        }, options).then(function () {
          delete $scope.progress.enabled
          delete $scope.credentials.password_needed
          $scope.credentials.phone_unoccupied = true
        }, function (error) {
          if (error.type &&
                    error.type.substr(0, 17) == '2FA_CONFIRM_WAIT_') {
            error.waitTime = error.type.substr(17)
            error.type = '2FA_CONFIRM_WAIT_TIME'
          }

          delete $scope.progress.enabled
        })
      })
    }

    function updatePasswordState () {
      // $timeout.cancel(updatePasswordTimeout)
      // updatePasswordTimeout = false
      return PasswordManager.getState(options).then(function (result) {
        return $scope.password = result
      // if (result._ == 'account.noPassword' && result.email_unconfirmed_pattern) {
      //   updatePasswordTimeout = $timeout(updatePasswordState, 5000)
      // }
      })
    }

    ChangelogNotifyService.checkUpdate()
    LayoutSwitchService.start()    
  }

})()
