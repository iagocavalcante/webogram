(function () {
    'use strict'
    angular
        .module('myApp.controllers', ['myApp.i18n'])
        .controller('UserModalController', UserModalController)


    function UserModalController ( $scope, $location, $rootScope, $modalInstance, AppProfileManager, $modal, AppUsersManager, MtpApiManager, NotificationsManager, AppPhotosManager, AppMessagesManager, AppPeersManager, PeersSelectService, ErrorService ) {
        var peerString = AppUsersManager.getUserString($scope.userID)

        $scope.user = AppUsersManager.getUser($scope.userID)
        $scope.blocked = false
    
        $scope.settings = {notifications: true}
    
        AppProfileManager.getProfile($scope.userID, $scope.override).then(function (userFull) {
          $scope.blocked = userFull.pFlags.blocked
          $scope.bot_info = userFull.bot_info
          $scope.rAbout = userFull.rAbout
    
          NotificationsManager.getPeerMuted($scope.userID).then(function (muted) {
            $scope.settings.notifications = !muted
    
            $scope.$watch('settings.notifications', function (newValue, oldValue) {
              if (newValue === oldValue) {
                return false
              }
              NotificationsManager.getPeerSettings($scope.userID).then(function (settings) {
                settings.mute_until = newValue ? 0 : 2000000000
                NotificationsManager.updatePeerSettings($scope.userID, settings)
              })
            })
          })
        })
    
        $scope.goToHistory = function () {
          $rootScope.$broadcast('history_focus', {peerString: peerString})
        }
    
        $scope.flushHistory = function (justClear) {
          ErrorService.confirm({type: justClear ? 'HISTORY_FLUSH' : 'HISTORY_FLUSH_AND_DELETE'}).then(function () {
            AppMessagesManager.flushHistory($scope.userID, justClear).then(function () {
              if (justClear) {
                $scope.goToHistory()
              } else {
                $modalInstance.close()
                $location.url('/im')
              }
            })
          })
        }
    
        $scope.importContact = function (edit) {
          var scope = $rootScope.$new()
          scope.importContact = {
            phone: $scope.user.phone,
            first_name: $scope.user.first_name,
            last_name: $scope.user.last_name
          }
    
          $modal.open({
            templateUrl: templateUrl(edit ? 'edit_contact_modal' : 'import_contact_modal'),
            controller: 'ImportContactModalController',
            windowClass: 'md_simple_modal_window mobile_modal',
            scope: scope
          }).result.then(function (foundUserID) {
            if ($scope.userID == foundUserID) {
              $scope.user = AppUsersManager.getUser($scope.userID)
            }
          })
        }
    
        $scope.deleteContact = function () {
          AppUsersManager.deleteContacts([$scope.userID]).then(function () {
            $scope.user = AppUsersManager.getUser($scope.userID)
          })
        }
    
        $scope.inviteToGroup = function () {
          PeersSelectService.selectPeer({
            confirm_type: 'INVITE_TO_GROUP',
            noUsers: true
          }).then(function (peerString) {
            var peerID = AppPeersManager.getPeerID(peerString)
            var chatID = peerID < 0 ? -peerID : 0
            AppMessagesManager.startBot($scope.user.id, chatID).then(function () {
              $rootScope.$broadcast('history_focus', {peerString: peerString})
            })
          })
        }
    
        $scope.sendCommand = function (command) {
          AppMessagesManager.sendText($scope.userID, '/' + command)
          $rootScope.$broadcast('history_focus', {
            peerString: peerString
          })
        }
    
        $scope.toggleBlock = function (block) {
          MtpApiManager.invokeApi(block ? 'contacts.block' : 'contacts.unblock', {
            id: AppUsersManager.getUserInput($scope.userID)
          }).then(function () {
            $scope.blocked = block
          })
        }
    
        $scope.shareContact = function () {
          PeersSelectService.selectPeer({confirm_type: 'SHARE_CONTACT_PEER', canSend: true}).then(function (peerString) {
            var peerID = AppPeersManager.getPeerID(peerString)
            AppMessagesManager.sendOther(peerID, {
              _: 'inputMediaContact',
              phone_number: $scope.user.phone,
              first_name: $scope.user.first_name,
              last_name: $scope.user.last_name,
              user_id: $scope.user.id
            })
            $rootScope.$broadcast('history_focus', {peerString: peerString})
          })
        }
    }
    
})()
