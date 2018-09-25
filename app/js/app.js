/*!
 * Webogram v0.7.0 - messaging web application for MTProto
 * https://github.com/zhukov/webogram
 * Copyright (C) 2014 Igor Zhukov <igor.beatle@gmail.com>
 * https://github.com/zhukov/webogram/blob/master/LICENSE
 */

'use strict'
/* global Config, templateUrl */

var extraModules = []
if (Config.Modes.animations) {
  extraModules.push('ngAnimate')
}

// Declare app level module which depends on filters, and services
angular.module('myApp', [
  'ngRoute',
  'ngSanitize',
  'ngTouch',
  'ui.bootstrap',
  'mediaPlayer',
  'toaster',
  'izhukov.utils',
  'izhukov.mtproto',
  'izhukov.mtproto.wrapper',
  'myApp.filters',
  'myApp.services',
  /*PRODUCTION_ONLY_BEGIN
  'myApp.templates',
  PRODUCTION_ONLY_END*/
  'myApp.directives',
  'im.controller',
  'im-dialog.controller',
  'im-history.controller',
  'im-send.controller',
  'im-panel.controller',
  'changelog-modal.controller',
  'welcome.controller',
  'channel-edit-modal.controller',
  'channel-modal.controller',
  'chat-create-modal.controller',
  'chat-edit-modal.controller',
  'chat-invite-link-modal.controller',
  'chat-modal.controller',
  'chat-pic-modal.controller',
  'contacts-modal.controller',
  'country-select-modal.controller',
  'document-modal.controller',
  'embed-modal.controller',
  'app-footer.controller',
  'game-modal.controller',
  'import-contact-modal.controller',
  'app-lang-select.controller',
  'app-login.controller',
  'password-recovery-modal.controller',
  'password-update-modal.controller',
  'peer-select.controller',
  'phonebook-modal.controller',
  'photo-modal.controller',
  'profile-edit-modal.controller',
  'sessions-list-modal.controller',
  'settings-modal.controller',
  'stickerset-modal.controller',
  'user-modal.controller',
  'user-pic-modal.controller',
  'username-edit-modal.controller',
  'video-modal.controller'
].concat(extraModules)).config(['$locationProvider', '$routeProvider', '$compileProvider', 'StorageProvider', function ($locationProvider, $routeProvider, $compileProvider, StorageProvider) {
  $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|file|blob|filesystem|chrome-extension|app):|data:image\//)
  $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|file|tg|mailto|blob|filesystem|chrome-extension|app):|data:/)

  /*PRODUCTION_ONLY_BEGIN
  $compileProvider.debugInfoEnabled(false)
  PRODUCTION_ONLY_END*/

  if (Config.Modes.test) {
    StorageProvider.setPrefix('t_')
  }

  $routeProvider.when('/', {template: '', controller: 'AppWelcomeController'})
  $routeProvider.when('/login', {templateUrl: templateUrl('login'), controller: 'AppLoginController'})
  $routeProvider.when('/im', {templateUrl: templateUrl('im'), controller: 'AppIMController', reloadOnSearch: false})
  $routeProvider.otherwise({redirectTo: '/'})
}])
