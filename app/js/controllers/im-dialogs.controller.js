(function () {
    'use strict'
    angular
      .module('im-dialog.controller', ['myApp.i18n'])
        .controller('AppImDialogsController', AppImDialogsController)

    function AppImDialogsController ( $scope, $location, $q, $timeout, $routeParams, MtpApiManager, AppUsersManager, AppChatsManager, AppMessagesManager, AppProfileManager, AppPeersManager, PhonebookContactsService, ErrorService, AppRuntimeManager ) {
        $scope.dialogs = []
        $scope.myResults = []
        $scope.foundPeers = []
        $scope.foundMessages = []
    
        if ($scope.search === undefined) {
          $scope.search = {}
        }
        if ($scope.isEmpty === undefined) {
          $scope.isEmpty = {}
        }
        $scope.phonebookAvailable = PhonebookContactsService.isAvailable()
    
        var searchMessages = false
        var offsetIndex = 0
        var maxID = 0
        var hasMore = false
        var jump = 0
        var contactsJump = 0
        var peersInDialogs = {}
        var typingTimeouts = {}
        var contactsShown
    
        $scope.$on('dialogs_need_more', function () {
          // console.log('on need more')
          showMoreDialogs()
        })
    
        $scope.$on('dialog_unread', function (e, dialog) {
          angular.forEach($scope.dialogs, function (curDialog) {
            if (curDialog.peerID == dialog.peerID) {
              curDialog.unreadCount = dialog.count
            }
          })
        })
    
        $scope.$on('history_search', function (e, peerID) {
          $scope.setSearchPeer(peerID)
        })
    
        $scope.$on('esc_no_more', function () {
          $scope.setSearchPeer(false)
        })
    
        $scope.$on('dialogs_multiupdate', function (e, dialogsUpdated) {
          if (searchMessages) {
            return false
          }
          if ($scope.search.query !== undefined &&
              $scope.search.query.length) {
            return false
          }
    
          var i
          var dialog
          var newPeer = false
          var len = $scope.dialogs.length
          for (i = 0; i < len; i++) {
            dialog = $scope.dialogs[i]
            if (dialogsUpdated[dialog.peerID]) {
              $scope.dialogs.splice(i, 1)
              i--
              len--
              AppMessagesManager.clearDialogCache(dialog.mid)
            }
          }
    
          angular.forEach(dialogsUpdated, function (dialog, peerID) {
            if ($scope.noUsers && peerID > 0) {
              return
            }
            if (!peersInDialogs[peerID]) {
              peersInDialogs[peerID] = true
              newPeer = true
            }
            $scope.dialogs.unshift(
              AppMessagesManager.wrapForDialog(dialog.top_message, dialog)
            )
          })
    
          sortDialogs()
    
          if (newPeer) {
            delete $scope.isEmpty.dialogs
            if (contactsShown) {
              showMoreConversations()
            }
          }
        })
    
        function deleteDialog (peerID) {
          for (var i = 0; i < $scope.dialogs.length; i++) {
            if ($scope.dialogs[i].peerID == peerID) {
              $scope.dialogs.splice(i, 1)
              break
            }
          }
        }
    
        function sortDialogs () {
          var myID = false
          if ($scope.forPeerSelect) {
            myID = AppUsersManager.getSelf().id
          }
          $scope.dialogs.sort(function (d1, d2) {
            if (d1.peerID == myID) {
              return -1
            }
            else if (d2.peerID == myID) {
              return 1
            }
            return d2.index - d1.index
          })
        }
    
        $scope.$on('dialog_top', function (e, dialog) {
          var curDialog, i, wrappedDialog
          var len = $scope.dialogs.length
          for (i = 0; i < len; i++) {
            curDialog = $scope.dialogs[i]
            if (curDialog.peerID == dialog.peerID) {
              wrappedDialog = AppMessagesManager.wrapForDialog(dialog.top_message, dialog)
              $scope.dialogs.splice(i, 1, wrappedDialog)
              break
            }
          }
          sortDialogs()
          if (wrappedDialog == $scope.dialogs[len - 1]) {
            $scope.dialogs.splice(len - 1, 1)
          }
        })
        $scope.$on('dialog_flush', function (e, update) {
          var curDialog, i
          for (i = 0; i < $scope.dialogs.length; i++) {
            curDialog = $scope.dialogs[i]
            if (curDialog.peerID == update.peerID) {
              curDialog.deleted = true
              break
            }
          }
        })
        $scope.$on('dialog_drop', function (e, dialog) {
          deleteDialog(dialog.peerID)
        })
    
        $scope.$on('dialog_draft', function (e, draftUpdate) {
          var curDialog, i
          for (i = 0; i < $scope.dialogs.length; i++) {
            curDialog = $scope.dialogs[i]
            if (curDialog.peerID == draftUpdate.peerID) {
              curDialog.draft = draftUpdate.draft
              if (draftUpdate.index) {
                curDialog.index = draftUpdate.index
              }
              sortDialogs()
              break
            }
          }
        })
    
        $scope.$on('history_delete', function (e, historyUpdate) {
          for (var i = 0; i < $scope.dialogs.length; i++) {
            if ($scope.dialogs[i].peerID == historyUpdate.peerID) {
              if (historyUpdate.msgs[$scope.dialogs[i].mid]) {
                $scope.dialogs[i].deleted = true
              }
              break
            }
          }
        })
    
        $scope.$on('apiUpdate', function (e, update) {
          switch (update._) {
            case 'updateUserTyping':
            case 'updateChatUserTyping':
              if (!AppUsersManager.hasUser(update.user_id)) {
                if (update.chat_id &&
                  AppChatsManager.hasChat(update.chat_id) &&
                  !AppChatsManager.isChannel(update.chat_id)) {
                  AppProfileManager.getChatFull(update.chat_id)
                }
                return
              }
              var peerID = update._ == 'updateUserTyping' ? update.user_id : -update.chat_id
              AppUsersManager.forceUserOnline(update.user_id)
              for (var i = 0; i < $scope.dialogs.length; i++) {
                if ($scope.dialogs[i].peerID == peerID) {
                  $scope.dialogs[i].typing = update.user_id
                  $timeout.cancel(typingTimeouts[peerID])
    
                  typingTimeouts[peerID] = $timeout(function () {
                    for (var i = 0; i < $scope.dialogs.length; i++) {
                      if ($scope.dialogs[i].peerID == peerID) {
                        if ($scope.dialogs[i].typing == update.user_id) {
                          delete $scope.dialogs[i].typing
                        }
                      }
                    }
                  }, 6000)
                  break
                }
              }
              break
          }
        })
    
        $scope.$watchCollection('search', function () {
          $scope.dialogs = []
          $scope.foundMessages = []
          searchMessages = !!$scope.searchPeer
          contactsJump++
          loadDialogs()
        })
    
        if (Config.Mobile) {
          $scope.$watch('curDialog.peer', function () {
            $scope.$broadcast('ui_dialogs_update')
          })
        }
    
        $scope.importPhonebook = function () {
          PhonebookContactsService.openPhonebookImport()
        }
    
        $scope.setSearchPeer = function (peerID) {
          $scope.searchPeer = peerID || false
          $scope.searchClear()
          if (peerID) {
            $scope.dialogs = []
            $scope.foundPeers = []
            searchMessages = true
            $scope.toggleSearch()
          } else {
            searchMessages = false
          }
          loadDialogs(true)
        }
    
        $scope.$on('contacts_update', function () {
          if (contactsShown) {
            showMoreConversations()
          }
        })
    
        $scope.$on('ui_dialogs_search_clear', $scope.searchClear)
    
        if (!$scope.noMessages) {
          $scope.$on('dialogs_search', function (e, data) {
            $scope.search.query = data.query || ''
            $scope.toggleSearch()
          })
        }
    
        var searchTimeoutPromise
        function getDialogs (force) {
          var curJump = ++jump
    
          $timeout.cancel(searchTimeoutPromise)
    
          if (searchMessages) {
            searchTimeoutPromise = (force || maxID) ? $q.when() : $timeout(angular.noop, 500)
            return searchTimeoutPromise.then(function () {
              var searchPeerID = $scope.searchPeer || false
              return AppMessagesManager.getSearch(searchPeerID, $scope.search.query, {_: 'inputMessagesFilterEmpty'}, maxID).then(function (result) {
                if (curJump != jump) {
                  return $q.reject()
                }
                var dialogs = []
                angular.forEach(result.history, function (messageID) {
                  var message = AppMessagesManager.getMessage(messageID)
                  var peerID = AppMessagesManager.getMessagePeer(message)
    
                  dialogs.push({
                    peerID: peerID,
                    top_message: messageID,
                    unread_count: -1
                  })
                })
    
                return {
                  dialogs: dialogs
                }
              })
            })
          }
    
          var query = $scope.search.query || ''
          if ($scope.noUsers) {
            query = '%pg ' + query
          }
          return AppMessagesManager.getConversations(query, offsetIndex).then(function (result) {
            if (curJump != jump) {
              return $q.reject()
            }
            if (!query && !offsetIndex && $scope.forPeerSelect) {
              var myID = AppUsersManager.getSelf().id
              return AppMessagesManager.getConversation(myID).then(function (dialog) {
                result.dialogs.unshift(dialog)
                return result
              })
            }
            return result
          })
        }
    
        function loadDialogs (force) {
          offsetIndex = 0
          maxID = 0
          hasMore = false
          if (!searchMessages) {
            peersInDialogs = {}
            contactsShown = false
          }
    
          getDialogs(force).then(function (dialogsResult) {
            if (!searchMessages) {
              $scope.dialogs = []
              $scope.myResults = []
              $scope.foundPeers = []
            }
            $scope.foundMessages = []
    
            var dialogsList = searchMessages ? $scope.foundMessages : $scope.dialogs
    
            if (dialogsResult.dialogs.length) {
              angular.forEach(dialogsResult.dialogs, function (dialog) {
                if ($scope.canSend &&
                    AppPeersManager.isChannel(dialog.peerID) &&
                    !AppChatsManager.hasRights(-dialog.peerID, 'send')) {
                  return
                }
                var wrapDialog = searchMessages ? undefined : dialog
                var wrappedDialog = AppMessagesManager.wrapForDialog(dialog.top_message, wrapDialog)
    
                if (searchMessages &&
                    $scope.searchPeer) {
                  var message = AppMessagesManager.getMessage(dialog.top_message)
                  if (message.fromID > 0) {
                    wrappedDialog.peerID = message.fromID
                    wrappedDialog.foundInHistory = true
                  }
                }
    
                if (searchMessages) {
                  wrappedDialog.unreadCount = -1
                } else {
                  if (peersInDialogs[dialog.peerID]) {
                    return
                  } else {
                    peersInDialogs[dialog.peerID] = true
                  }
                }
                dialogsList.push(wrappedDialog)
              })
    
              if (searchMessages) {
                maxID = dialogsResult.dialogs[dialogsResult.dialogs.length - 1].top_message
              } else {
                offsetIndex = dialogsResult.dialogs[dialogsResult.dialogs.length - 1].index
                delete $scope.isEmpty.dialogs
              }
              hasMore = true
            } else {
              hasMore = false
            }
    
            $scope.$broadcast('ui_dialogs_change')
    
            if (!$scope.search.query) {
              AppMessagesManager.getConversations('', offsetIndex, 100)
              if (!dialogsResult.dialogs.length) {
                $scope.isEmpty.dialogs = true
                showMoreDialogs()
              }
            } else {
              showMoreDialogs()
            }
          })
        }
    
        function showMoreDialogs () {
          if (contactsShown && (!hasMore || (!offsetIndex && !maxID))) {
            return
          }
    
          if (!hasMore &&
            !searchMessages &&
            !$scope.noUsers &&
            ($scope.search.query || !$scope.dialogs.length)) {
            showMoreConversations()
            return
          }
    
          getDialogs().then(function (dialogsResult) {
            if (dialogsResult.dialogs.length) {
              var dialogsList = searchMessages ? $scope.foundMessages : $scope.dialogs
    
              angular.forEach(dialogsResult.dialogs, function (dialog) {
                if ($scope.canSend &&
                    AppPeersManager.isChannel(dialog.peerID) &&
                    !AppChatsManager.hasRights(-dialog.peerID, 'send')) {
                  return
                }
                var wrapDialog = searchMessages ? undefined : dialog
                var wrappedDialog = AppMessagesManager.wrapForDialog(dialog.top_message, wrapDialog)
    
                if (searchMessages) {
                  wrappedDialog.unreadCount = -1
                } else {
                  if (peersInDialogs[dialog.peerID]) {
                    return
                  } else {
                    peersInDialogs[dialog.peerID] = true
                  }
                }
    
                if (searchMessages &&
                    $scope.searchPeer) {
                  var message = AppMessagesManager.getMessage(dialog.top_message)
                  if (message.fromID > 0) {
                    wrappedDialog.peerID = message.fromID
                  }
                }
    
                dialogsList.push(wrappedDialog)
              })
    
              if (searchMessages) {
                maxID = dialogsResult.dialogs[dialogsResult.dialogs.length - 1].top_message
              } else {
                offsetIndex = dialogsResult.dialogs[dialogsResult.dialogs.length - 1].index
              }
    
              $scope.$broadcast('ui_dialogs_append')
    
              hasMore = true
            } else {
              hasMore = false
            }
          })
        }
    
        function showMoreConversations () {
          contactsShown = true
    
          var curJump = ++contactsJump
          AppUsersManager.getContacts($scope.search.query).then(function (contactsList) {
            if (curJump != contactsJump) return
            $scope.myResults = []
            angular.forEach(contactsList, function (userID) {
              if (peersInDialogs[userID] === undefined) {
                $scope.myResults.push({
                  id: userID,
                  peerString: AppUsersManager.getUserString(userID)
                })
              }
            })
    
            if (contactsList.length) {
              delete $scope.isEmpty.contacts
            } else if (!$scope.search.query) {
              $scope.isEmpty.contacts = true
            }
            $scope.$broadcast('ui_dialogs_append')
          })
    
          if ($scope.search.query && $scope.search.query.length >= 2) {
            $timeout(function () {
              if (curJump != contactsJump) return
              MtpApiManager.invokeApi('contacts.search', {q: $scope.search.query, limit: 10}).then(function (result) {
                AppUsersManager.saveApiUsers(result.users)
                AppChatsManager.saveApiChats(result.chats)
                if (curJump != contactsJump) return
                var alreadyPeers = []
                angular.forEach($scope.myResults, function (peerFound) {
                  alreadyPeers.push(peerFound.id)
                })
                angular.forEach(result.my_results, function (peerFound) {
                  var peerID = AppPeersManager.getPeerID(peerFound)
                  if (peersInDialogs[peerID] === undefined &&
                      alreadyPeers.indexOf(peerID) == -1) {
                    alreadyPeers.push(peerID)
                    if ($scope.canSend &&
                      AppPeersManager.isChannel(peerID) &&
                      !AppChatsManager.hasRights(-peerID, 'send')) {
                      return
                    }
                    $scope.myResults.push({
                      id: peerID,
                      peerString: AppPeersManager.getPeerString(peerID)
                    })
                  }
                })
    
                $scope.foundPeers = []
                angular.forEach(result.results, function (peerFound) {
                  var peerID = AppPeersManager.getPeerID(peerFound)
                  if (peersInDialogs[peerID] === undefined &&
                      alreadyPeers.indexOf(peerID) == -1) {
                    if ($scope.canSend &&
                      AppPeersManager.isChannel(peerID) &&
                      !AppChatsManager.hasRights(-peerID, 'send')) {
                      return
                    }
                    alreadyPeers.push(peerID)
                    $scope.foundPeers.push({
                      id: peerID,
                      username: AppPeersManager.getPeer(peerID).username,
                      peerString: AppUsersManager.getUserString(peerID)
                    })
                  }
                })
              }, function (error) {
                if (error.code == 400) {
                  error.handled = true
                }
              })
            }, 500)
          }
    
          if ($scope.search.query && !$scope.noMessages) {
            searchMessages = true
            loadDialogs()
          }
        }
    }

})()
