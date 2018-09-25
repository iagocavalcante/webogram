(function () {
  'use strict'
  angular
    .module('im.controller', ['myApp.i18n'])
    .controller('AppIMController', AppIMController)
    
  function AppIMController ( $q, qSync, $scope, $location, $routeParams, $modal, $rootScope, $modalStack, MtpApiManager, AppUsersManager, AppChatsManager, AppMessagesManager, AppPeersManager, ContactsSelectService, ChangelogNotifyService, ErrorService, AppRuntimeManager, HttpsMigrateService, LayoutSwitchService, LocationParamsService, AppStickersManager ) {
      $scope.$on('$routeUpdate', updateCurDialog)

      var pendingParams = false
      var pendingAttachment = false
      $scope.$on('history_focus', function (e, peerData) {
        if (peerData.peerString == $scope.curDialog.peer &&
            (peerData.messageID ? peerData.messageID == $scope.curDialog.messageID : !$scope.curDialog.messageID) &&
            !peerData.startParam &&
            !peerData.attachment) {
          if (peerData.messageID) {
            $scope.$broadcast('ui_history_change_scroll', true)
          } else {
            $scope.$broadcast('ui_history_focus')
          }
          $modalStack.dismissAll()
        } else {
          var peerID = AppPeersManager.getPeerID(peerData.peerString)
          var username = AppPeersManager.getPeer(peerID).username
          var peer = username ? '@' + username : peerData.peerString
          if (peerData.messageID || peerData.startParam) {
            pendingParams = {
              messageID: peerData.messageID,
              startParam: peerData.startParam
            }
          } else {
            pendingParams = false
          }
          if (peerData.attachment) {
            pendingAttachment = peerData.attachment
          }
          if ($routeParams.p != peer) {
            $location.url('/im?p=' + peer)
          } else {
            updateCurDialog()
          }
        }
      })
  
      $scope.$on('esc_no_more', function () {
        $rootScope.$apply(function () {
          $location.url('/im')
        })
      })
  
      $scope.isLoggedIn = true
      $scope.isEmpty = {}
      $scope.search = {}
      $scope.historyFilter = {mediaType: false}
      $scope.historyPeer = {}
      $scope.historyState = {
        selectActions: false,
        botActions: false,
        channelActions: false,
        canReply: false,
        canDelete: false,
        canEdit: false,
        actions: function () {
          return $scope.historyState.selectActions ? 'selected' : ($scope.historyState.botActions ? 'bot' : ($scope.historyState.channelActions ? 'channel' : false))
        },
        typing: [],
        missedCount: 0,
        skipped: false
      }
  
      $scope.openSettings = function () {
        $modal.open({
          templateUrl: templateUrl('settings_modal'),
          controller: 'SettingsModalController',
          windowClass: 'settings_modal_window mobile_modal',
          backdrop: 'single'
        })
      }
  
      $scope.isHistoryPeerGroup = function () {
        return $scope.historyPeer.id < 0 && !AppPeersManager.isBroadcast($scope.historyPeer.id)
      }
  
      // setTimeout($scope.openSettings, 1000)
  
      $scope.openFaq = function () {
        var url = 'https://telegram.org/faq'
        switch (Config.I18n.locale) {
          case 'es-es':
            url += '/es'
            break
          case 'it-it':
            url += '/it'
            break
          case 'de-de':
            url += '/de'
            break
          case 'ko-ko':
            url += '/ko'
            break
          case 'pt-br':
            url += '/br'
            break
        }
        var popup = window.open(url, '_blank')
        try {
          popup.opener = null;
        } catch (e) {}
      }
  
      $scope.openContacts = function () {
        ContactsSelectService.selectContact().then(function (userID) {
          $scope.dialogSelect(AppUsersManager.getUserString(userID))
        })
      }
  
      $scope.openGroup = function () {
        ContactsSelectService.selectContacts({action: 'new_group'}).then(function (userIDs) {
          if (userIDs && 
              userIDs.length) {
            var scope = $rootScope.$new()
            scope.userIDs = userIDs
  
            $modal.open({
              templateUrl: templateUrl('chat_create_modal'),
              controller: 'ChatCreateModalController',
              scope: scope,
              windowClass: 'md_simple_modal_window mobile_modal',
              backdrop: 'single'
            })
          }
        })
      }
  
      $scope.importContact = function () {
        AppUsersManager.openImportContact().then(function (foundContact) {
          if (foundContact) {
            $rootScope.$broadcast('history_focus', {
              peerString: AppUsersManager.getUserString(foundContact)
            })
          }
        })
      }
  
      $scope.searchClear = function () {
        $scope.search.query = ''
        $scope.$broadcast('search_clear')
      }
  
      $scope.dialogSelect = function (peerString, messageID) {
        var params = {peerString: peerString}
        if (messageID) {
          params.messageID = messageID
        } else if ($scope.search.query) {
          $scope.searchClear()
        }
        var peerID = AppPeersManager.getPeerID(peerString)
        var converted = AppMessagesManager.convertMigratedPeer(peerID)
        if (converted) {
          params.peerString = AppPeersManager.getPeerString(converted)
        }
        $rootScope.$broadcast('history_focus', params)
      }
  
      $scope.logOut = function () {
        ErrorService.confirm({type: 'LOGOUT'}).then(function () {
          MtpApiManager.logOut().then(function () {
            location.hash = '/login'
            AppRuntimeManager.reload()
          })
        })
      }
  
      $scope.openChangelog = function () {
        ChangelogNotifyService.showChangelog(false)
      }
  
      $scope.showPeerInfo = function () {
        if ($scope.curDialog.peerID > 0) {
          AppUsersManager.openUser($scope.curDialog.peerID)
        } else if ($scope.curDialog.peerID < 0) {
          AppChatsManager.openChat(-$scope.curDialog.peerID)
        }
      }
  
      $scope.toggleEdit = function () {
        $scope.$broadcast('history_edit_toggle')
      }
      $scope.selectedFlush = function () {
        $scope.$broadcast('history_edit_flush')
      }
      $scope.toggleMedia = function (mediaType) {
        $scope.$broadcast('history_media_toggle', mediaType)
      }
      $scope.returnToRecent = function () {
        $scope.$broadcast('history_return_recent')
      }
      $scope.toggleSearch = function () {
        $scope.$broadcast('dialogs_search_toggle')
      }
  
      updateCurDialog()
  
      function updateCurDialog () {
        $modalStack.dismissAll()
        var addParams = pendingParams || {}
        pendingParams = false
        addParams.messageID = parseInt(addParams.messageID) || false
        addParams.startParam = addParams.startParam
  
        var peerStringPromise
        if ($routeParams.p && $routeParams.p.charAt(0) == '@') {
          if ($scope.curDialog === undefined) {
            $scope.curDialog = {
              peer: '',
              peerID: 0
            }
          }
          peerStringPromise = AppPeersManager.resolveUsername($routeParams.p.substr(1)).then(function (peerID) {
            return qSync.when(AppPeersManager.getPeerString(peerID))
          })
        } else {
          peerStringPromise = qSync.when($routeParams.p)
        }
        peerStringPromise.then(function (peerString) {
          $scope.curDialog = angular.extend({
            peer: peerString,
            peerID: AppPeersManager.getPeerID(peerString || '')
          }, addParams)
          if (pendingAttachment) {
            $scope.$broadcast('peer_draft_attachment', pendingAttachment)
            pendingAttachment = false
          }
        })
      }
  
      ChangelogNotifyService.checkUpdate()
      HttpsMigrateService.start()
      LayoutSwitchService.start()
      LocationParamsService.start()
      AppStickersManager.start()
  }

})()
