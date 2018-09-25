(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('SettingsModalController', SettingsModalController)

    function SettingsModalController($rootScope, $scope, $timeout, $modal, AppUsersManager, AppChatsManager, AppPhotosManager, MtpApiManager, Storage, NotificationsManager, MtpApiFileManager, PasswordManager, ApiUpdatesManager, ChangelogNotifyService, LayoutSwitchService, WebPushApiManager, AppRuntimeManager, ErrorService, _ ) {
        $scope.profile = {}
        $scope.photo = {}
        $scope.version = Config.App.version

        MtpApiManager.getUserID().then(function (id) {
            $scope.profile = AppUsersManager.getUser(id)
        })

        MtpApiManager.invokeApi('users.getFullUser', {
            id: { _: 'inputUserSelf' }
        }).then(function (userFullResult) {
            AppUsersManager.saveApiUser(userFullResult.user)
            if (userFullResult.profile_photo) {
                AppPhotosManager.savePhoto(userFullResult.profile_photo, {
                    user_id: userFullResult.user.id
                })
            }
        })

        $scope.notify = { volume: 0.5 }
        $scope.send = {}

        $scope.$watch('photo.file', onPhotoSelected)

        $scope.password = { _: 'account.noPassword' }
        updatePasswordState()
        var updatePasswordTimeout = false
        var stopped = false

        $scope.changePassword = function (options) {
            options = options || {}
            if (options.action == 'cancel_email') {
                return ErrorService.confirm({ type: 'PASSWORD_ABORT_SETUP' }).then(function () {
                    PasswordManager.updateSettings($scope.password, { email: '' }).then(updatePasswordState)
                })
            }
            var scope = $rootScope.$new()
            scope.password = $scope.password
            angular.extend(scope, options)
            var modal = $modal.open({
                scope: scope,
                templateUrl: templateUrl('password_update_modal'),
                controller: 'PasswordUpdateModalController',
                windowClass: 'md_simple_modal_window mobile_modal'
            })

            modal.result['finally'](updatePasswordState)
        }

        $scope.showSessions = function () {
            $modal.open({
                templateUrl: templateUrl('sessions_list_modal'),
                controller: 'SessionsListModalController',
                windowClass: 'md_simple_modal_window mobile_modal'
            })
        }

        function updatePasswordState() {
            $timeout.cancel(updatePasswordTimeout)
            updatePasswordTimeout = false
            PasswordManager.getState().then(function (result) {
                $scope.password = result
                if (result._ == 'account.noPassword' && result.email_unconfirmed_pattern && !stopped) {
                    updatePasswordTimeout = $timeout(updatePasswordState, 5000)
                }
            })
        }

        $scope.$on('$destroy', function () {
            $timeout.cancel(updatePasswordTimeout)
            stopped = true
        })

        function onPhotoSelected(photo) {
            if (!photo || !photo.type || photo.type.indexOf('image') !== 0) {
                return
            }
            $scope.photo.updating = true
            MtpApiFileManager.uploadFile(photo).then(function (inputFile) {
                MtpApiManager.invokeApi('photos.uploadProfilePhoto', {
                    file: inputFile,
                    caption: '',
                    geo_point: { _: 'inputGeoPointEmpty' }
                }).then(function (updateResult) {
                    AppUsersManager.saveApiUsers(updateResult.users)
                    MtpApiManager.getUserID().then(function (id) {
                        AppPhotosManager.savePhoto(updateResult.photo, {
                            user_id: id
                        })
                        ApiUpdatesManager.processUpdateMessage({
                            _: 'updateShort',
                            update: {
                                _: 'updateUserPhoto',
                                user_id: id,
                                date: tsNow(true),
                                photo: AppUsersManager.getUser(id).photo,
                                previous: true
                            }
                        })
                        $scope.photo = {}
                    })
                })
            })['finally'](function () {
                delete $scope.photo.updating
            })
        }

        $scope.deletePhoto = function () {
            $scope.photo.updating = true
            MtpApiManager.invokeApi('photos.updateProfilePhoto', {
                id: { _: 'inputPhotoEmpty' }
            }).then(function (updateResult) {
                MtpApiManager.getUserID().then(function (id) {
                    ApiUpdatesManager.processUpdateMessage({
                        _: 'updateShort',
                        update: {
                            _: 'updateUserPhoto',
                            user_id: id,
                            date: tsNow(true),
                            photo: updateResult,
                            previous: true
                        }
                    })
                    $scope.photo = {}
                })
            })['finally'](function () {
                delete $scope.photo.updating
            })
        }

        $scope.editProfile = function () {
            $modal.open({
                templateUrl: templateUrl('profile_edit_modal'),
                controller: 'ProfileEditModalController',
                windowClass: 'md_simple_modal_window mobile_modal'
            })
        }

        $scope.changeUsername = function () {
            $modal.open({
                templateUrl: templateUrl('username_edit_modal'),
                controller: 'UsernameEditModalController',
                windowClass: 'md_simple_modal_window mobile_modal'
            })
        }

        $scope.terminateSessions = function () {
            ErrorService.confirm({ type: 'TERMINATE_SESSIONS' }).then(function () {
                MtpApiManager.invokeApi('auth.resetAuthorizations', {})
            })
        }

        Storage.get('notify_nodesktop', 'send_ctrlenter', 'notify_volume', 'notify_novibrate', 'notify_nopreview', 'notify_nopush').then(function (settings) {
            $scope.notify.desktop = !settings[0]
            $scope.send.enter = settings[1] ? '' : '1'

            $scope.notify.pushAvailable = WebPushApiManager.isAvailable
            $scope.notify.push = !settings[5]

            if (settings[2] !== false) {
                $scope.notify.volume = settings[2] > 0 && settings[2] <= 1.0 ? settings[2] : 0
            } else {
                $scope.notify.volume = 0.5
            }

            $scope.notify.canVibrate = NotificationsManager.getVibrateSupport()
            $scope.notify.vibrate = !settings[3]

            $scope.notify.preview = !settings[4]

            $scope.notify.volumeOf4 = function () {
                return 1 + Math.ceil(($scope.notify.volume - 0.1) / 0.33)
            }

            $scope.toggleSound = function () {
                if ($scope.notify.volume) {
                    $scope.notify.volume = 0
                } else {
                    $scope.notify.volume = 0.5
                }
            }

            var testSoundPromise
            $scope.$watch('notify.volume', function (newValue, oldValue) {
                if (newValue !== oldValue) {
                    Storage.set({ notify_volume: newValue })
                    $rootScope.$broadcast('settings_changed')
                    NotificationsManager.clear()

                    if (testSoundPromise) {
                        $timeout.cancel(testSoundPromise)
                    }
                    testSoundPromise = $timeout(function () {
                        NotificationsManager.testSound(newValue)
                    }, 500)
                }
            })

            $scope.toggleDesktop = function () {
                $scope.notify.desktop = !$scope.notify.desktop

                if ($scope.notify.desktop) {
                    Storage.remove('notify_nodesktop')
                } else {
                    Storage.set({ notify_nodesktop: true })
                }
                $rootScope.$broadcast('settings_changed')
            }

            $scope.togglePush = function () {
                $scope.notify.push = !$scope.notify.push

                if ($scope.notify.push) {
                    Storage.remove('notify_nopush')
                } else {
                    Storage.set({ notify_nopush: true })
                }
                $rootScope.$broadcast('settings_changed')
            }

            $scope.togglePreview = function () {
                $scope.notify.preview = !$scope.notify.preview

                if ($scope.notify.preview) {
                    Storage.remove('notify_nopreview')
                } else {
                    Storage.set({ notify_nopreview: true })
                }
                $rootScope.$broadcast('settings_changed')
            }

            $scope.toggleVibrate = function () {
                $scope.notify.vibrate = !$scope.notify.vibrate

                if ($scope.notify.vibrate) {
                    Storage.remove('notify_novibrate')
                } else {
                    Storage.set({ notify_novibrate: true })
                }
                $rootScope.$broadcast('settings_changed')
            }

            $scope.toggleCtrlEnter = function (newValue) {
                $scope.send.enter = newValue

                if ($scope.send.enter) {
                    Storage.remove('send_ctrlenter')
                } else {
                    Storage.set({ send_ctrlenter: true })
                }
                $rootScope.$broadcast('settings_changed')
            }
        })

        $scope.openChangelog = function () {
            ChangelogNotifyService.showChangelog(false)
        }

        $scope.logOut = function () {
            ErrorService.confirm({ type: 'LOGOUT' }).then(function () {
                MtpApiManager.logOut().then(function () {
                    location.hash = '/login'
                    AppRuntimeManager.reload()
                })
            })
        }

        $scope.switchBackToDesktop = Config.Mobile && !Config.Navigator.mobile
        $scope.switchToDesktop = function () {
            LayoutSwitchService.switchLayout(false)
        }
    }
    
})()
