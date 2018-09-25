(function () {
    'use strict'
    angular
      .module('im-history.controller', ['myApp.i18n'])
        .controller('AppImHistoryController', AppImHistoryController)

    function AppImHistoryController ( $scope, $location, $timeout, $modal, $rootScope, toaster, _, MtpApiManager, AppUsersManager, AppChatsManager, AppMessagesManager, AppPeersManager, ApiUpdatesManager, PeersSelectService, IdleManager, StatusManager, NotificationsManager, ErrorService, GeoLocationManager ) {
        $scope.$watchCollection('curDialog', applyDialogSelect)

        ApiUpdatesManager.attach()
        IdleManager.start()
        StatusManager.start()
    
        $scope.peerHistories = []
        $scope.selectedMsgs = {}
        $scope.selectedCount = 0
        $scope.historyState.selectActions = false
        $scope.historyState.botActions = false
        $scope.historyState.channelActions = false
        $scope.historyState.canDelete = false
        $scope.historyState.canReply = false
        $scope.historyState.missedCount = 0
        $scope.historyState.skipped = false
        $scope.state = {}
    
        $scope.toggleMessage = toggleMessage
        $scope.selectedDelete = selectedDelete
        $scope.selectedForward = selectedForward
        $scope.selectedReply = selectedReply
        $scope.selectedEdit = selectedEdit
        $scope.selectedCancel = selectedCancel
        $scope.selectedFlush = selectedFlush
        $scope.selectInlineBot = selectInlineBot
    
        $scope.startBot = startBot
        $scope.cancelBot = cancelBot
        $scope.joinChannel = joinChannel
        $scope.togglePeerMuted = togglePeerMuted
    
        $scope.toggleEdit = toggleEdit
        $scope.toggleMedia = toggleMedia
        $scope.returnToRecent = returnToRecent
    
        $scope.$on('history_edit_toggle', toggleEdit)
        $scope.$on('history_edit_flush', selectedFlush)
        $scope.$on('history_media_toggle', function (e, mediaType) {
          toggleMedia(mediaType)
        })
    
        $scope.$on('history_return_recent', returnToRecent)
    
        var peerID
        var peerHistory = false
        var unreadAfterIdle = false
        var hasMore = false
        var hasLess = false
        var maxID = 0
        var minID = 0
        var lastSelectID = false
        var inputMediaFilters = {
          photos: 'inputMessagesFilterPhotos',
          video: 'inputMessagesFilterVideo',
          documents: 'inputMessagesFilterDocument',
          audio: 'inputMessagesFilterVoice',
          round: 'inputMessagesFilterRoundVideo',
          music: 'inputMessagesFilterMusic',
          urls: 'inputMessagesFilterUrl',
          mentions: 'inputMessagesFilterMyMentions'
        }
        var jump = 0
        var moreJump = 0
        var moreActive = false
        var morePending = false
        var lessJump = 0
        var lessActive = false
        var lessPending = false
    
        function applyDialogSelect (newDialog, oldDialog) {
          peerID = $rootScope.selectedPeerID = newDialog.peerID
          var migratedToPeer = AppPeersManager.getPeerMigratedTo(peerID)
          if (migratedToPeer) {
            $rootScope.$broadcast('history_focus', {
              peerString: AppPeersManager.getPeerString(migratedToPeer)
            })
            return
          }
          $scope.historyFilter.mediaType = false
    
          AppPeersManager.getInputPeer(newDialog.peer || $scope.curDialog.peer || '')
    
          updateBotActions()
          selectedCancel(true)
    
          if (oldDialog.peer &&
              oldDialog.peer == newDialog.peer &&
              newDialog.messageID) {
            messageFocusHistory()
          } else if (peerID) {
            updateHistoryPeer(true)
            loadHistory()
          } else {
            showEmptyHistory()
          }
        }
    
        function historiesQueuePush (peerID) {
          var pos = -1
          var maxLen = 10
          var i, history, diff
    
          for (i = 0; i < $scope.peerHistories.length; i++) {
            if ($scope.peerHistories[i].peerID == peerID) {
              pos = i
              break
            }
          }
          if (pos > -1) {
            history = $scope.peerHistories[pos]
            return history
          }
          history = {peerID: peerID, messages: [], ids: []}
          $scope.peerHistories.unshift(history)
          diff = $scope.peerHistories.length - maxLen
          if (diff > 0) {
            $scope.peerHistories.splice(maxLen - 1, diff)
          }
    
          return history
        }
    
        function historiesQueueFind (peerID) {
          var i
          for (i = 0; i < $scope.peerHistories.length; i++) {
            if ($scope.peerHistories[i].peerID == peerID) {
              return $scope.peerHistories[i]
            }
          }
          return false
        }
    
        function historiesQueuePop (peerID) {
          var i
          for (i = 0; i < $scope.peerHistories.length; i++) {
            if ($scope.peerHistories[i].peerID == peerID) {
              $scope.peerHistories.splice(i, 1)
              return true
            }
          }
          return false
        }
    
        function updateHistoryPeer (preload) {
          var peerData = AppPeersManager.getPeer(peerID)
          // console.log('update', preload, peerData)
          if (!peerData || peerData.deleted) {
            safeReplaceObject($scope.state, {loaded: false})
            return false
          }
    
          peerHistory = historiesQueuePush(peerID)
    
          safeReplaceObject($scope.historyPeer, {
            id: peerID,
            data: peerData
          })
    
          MtpApiManager.getUserID().then(function (myID) {
            $scope.ownID = myID
          })
    
          if (preload) {
            $scope.historyState.typing.splice(0, $scope.historyState.typing.length)
            $scope.$broadcast('ui_peer_change')
            $scope.$broadcast('ui_history_change')
            safeReplaceObject($scope.state, {loaded: true, empty: !peerHistory.messages.length, mayBeHasMore: true})
    
            updateBotActions()
            updateChannelActions()
          }
        }
    
        function updateBotActions () {
          var wasBotActions = $scope.historyState.botActions
          if (!peerID ||
            peerID < 0 ||
            !AppUsersManager.isBot(peerID) ||
            $scope.historyFilter.mediaType ||
            $scope.curDialog.messageID) {
            $scope.historyState.botActions = false
          } else if (
            $scope.state.empty || (
            peerHistory &&
            peerHistory.messages.length == 1 &&
            peerHistory.messages[0].action &&
            peerHistory.messages[0].action._ == 'messageActionBotIntro'
            )
          ) {
            $scope.historyState.botActions = 'start'
          } else if ($scope.curDialog.startParam) {
            $scope.historyState.botActions = 'param'
          } else {
            $scope.historyState.botActions = false
          }
          if (wasBotActions != $scope.historyState.botActions) {
            $scope.$broadcast('ui_panel_update')
          }
        }
    
        function updateChannelActions () {
          var wasChannelActions = $scope.historyState.channelActions
          var channel
          if (peerID &&
            AppPeersManager.isChannel(peerID) &&
            (channel = AppChatsManager.getChat(-peerID))) {
            var canSend = AppChatsManager.hasRights(-peerID, 'send')
            if (!canSend) {
              if (channel.pFlags.left) {
                $scope.historyState.channelActions = 'join'
              } else {
                if (!$scope.historyState.channelActions) {
                  $scope.historyState.channelActions = 'mute'
                }
                NotificationsManager.getPeerMuted(peerID).then(function (muted) {
                  $scope.historyState.channelActions = muted ? 'unmute' : 'mute'
                })
              }
            } else {
              $scope.historyState.channelActions = false
            }
            $scope.historyState.canReply = canSend
            $scope.historyState.canDelete = canSend || channel.pFlags.moderator
          } else {
            $scope.historyState.channelActions = false
            $scope.historyState.canReply = true
            $scope.historyState.canDelete = true
          }
          if (wasChannelActions != $scope.historyState.channelActions) {
            $scope.$broadcast('ui_panel_update')
          }
        }
    
        function messageFocusHistory () {
          var history = historiesQueueFind(peerID)
    
          if (history &&
            history.ids.indexOf($scope.curDialog.messageID) != -1) {
            $scope.historyUnread = {}
            var focusedMsgID = $scope.curDialog.messageID || 0
            $scope.$broadcast('messages_focus', focusedMsgID)
            $scope.$broadcast('ui_history_change_scroll', true)
          } else {
            loadHistory()
          }
        }
    
        function showLessHistory () {
          if (!hasLess) {
            return
          }
          if (moreActive) {
            lessPending = true
            return
          }
          lessPending = false
          $scope.state.lessActive = lessActive = true
    
          var curJump = jump
          var curLessJump = ++lessJump
          var limit = 0
          var backLimit = 20
          AppMessagesManager.getHistory($scope.curDialog.peerID, minID, limit, backLimit).then(function (historyResult) {
            $scope.state.lessActive = lessActive = false
            if (curJump != jump || curLessJump != lessJump) return
    
            var i, id
            for (i = historyResult.history.length - 1; i >= 0; i--) {
              id = historyResult.history[i]
              if (id > minID) {
                peerHistory.messages.push(AppMessagesManager.wrapForHistory(id))
                peerHistory.ids.push(id)
              }
            }
    
            if (historyResult.history.length) {
              minID = historyResult.history.length >= backLimit
                ? historyResult.history[0]
                : 0
              if (AppMessagesManager.regroupWrappedHistory(peerHistory.messages, -backLimit)) {
                $scope.$broadcast('messages_regroup')
              }
              delete $scope.state.empty
              $scope.$broadcast('ui_history_append')
            } else {
              minID = 0
            }
            $scope.historyState.skipped = hasLess = minID > 0
    
            if (morePending) {
              showMoreHistory()
            }
          })
        }
    
        function showMoreHistory () {
          if (!hasMore) {
            return
          }
          if (lessActive) {
            morePending = true
            return
          }
          morePending = false
          $scope.state.moreActive = moreActive = true
    
          var curJump = jump
          var curMoreJump = ++moreJump
          var inputMediaFilter = $scope.historyFilter.mediaType && {_: inputMediaFilters[$scope.historyFilter.mediaType]}
          var limit = Config.Mobile ? 20 : 0
          var getMessagesPromise = inputMediaFilter
            ? AppMessagesManager.getSearch($scope.curDialog.peerID, '', inputMediaFilter, maxID, limit)
            : AppMessagesManager.getHistory($scope.curDialog.peerID, maxID, limit)
    
          getMessagesPromise.then(function (historyResult) {
            $scope.state.moreActive = moreActive = false
            if (curJump != jump || curMoreJump != moreJump) return
    
            angular.forEach(historyResult.history, function (id) {
              peerHistory.messages.unshift(AppMessagesManager.wrapForHistory(id))
              peerHistory.ids.unshift(id)
            })
    
            hasMore = historyResult.count === null ||
              (historyResult.history.length && peerHistory.messages.length < historyResult.count)
    
            if (historyResult.history.length) {
              delete $scope.state.empty
              maxID = historyResult.history[historyResult.history.length - 1]
              $scope.$broadcast('ui_history_prepend')
              if (AppMessagesManager.regroupWrappedHistory(peerHistory.messages, historyResult.history.length + 1)) {
                $scope.$broadcast('messages_regroup')
              }
            }
    
            if (lessPending) {
              showLessHistory()
            }
          })
        }
    
        function loadHistory (forceRecent) {
          $scope.historyState.missedCount = 0
    
          hasMore = false
          $scope.historyState.skipped = hasLess = false
          maxID = 0
          minID = 0
          peerHistory = historiesQueuePush(peerID)
    
          var limit = 0
          var backLimit = 0
    
          if ($scope.curDialog.messageID) {
            maxID = parseInt($scope.curDialog.messageID)
            limit = 20
            backLimit = 20
          } else if (forceRecent) {
            limit = 10
          }
    
          $scope.state.moreActive = moreActive = false
          morePending = false
          $scope.state.lessActive = lessActive = false
          lessPending = false
    
          var prerenderedLen = peerHistory.messages.length
          if (prerenderedLen && (maxID || backLimit)) {
            prerenderedLen = 0
            peerHistory.messages = []
            peerHistory.ids = []
            $scope.state.empty = true
          }
    
          var curJump = ++jump
          var inputMediaFilter = $scope.historyFilter.mediaType && {_: inputMediaFilters[$scope.historyFilter.mediaType]}
          var getMessagesPromise = inputMediaFilter
            ? AppMessagesManager.getSearch($scope.curDialog.peerID, '', inputMediaFilter, maxID)
            : AppMessagesManager.getHistory($scope.curDialog.peerID, maxID, limit, backLimit, prerenderedLen)
    
          $scope.state.mayBeHasMore = true
          // console.log(dT(), 'start load history', $scope.curDialog)
          getMessagesPromise.then(function (historyResult) {
            if (curJump != jump) return
            // console.log(dT(), 'history loaded', angular.copy(historyResult))
    
            var fetchedLength = historyResult.history.length
    
            minID = (historyResult.unreadSkip || (maxID && historyResult.history.indexOf(maxID) >= backLimit - 1))
              ? historyResult.history[0]
              : 0
            maxID = historyResult.history[historyResult.history.length - 1]
    
            $scope.historyState.skipped = hasLess = minID > 0
            hasMore = historyResult.count === null ||
              (fetchedLength && fetchedLength < historyResult.count)
    
            updateHistoryPeer()
            safeReplaceObject($scope.state, {loaded: true, empty: !fetchedLength})
    
            peerHistory.messages = []
            peerHistory.ids = []
            angular.forEach(historyResult.history, function (id) {
              var message = AppMessagesManager.wrapForHistory(id)
              if ($scope.historyState.skipped) {
                delete message.pFlags.unread
              }
              if (historyResult.unreadOffset) {
                message.unreadAfter = true
              }
              peerHistory.messages.push(message)
              peerHistory.ids.push(id)
            })
            peerHistory.messages.reverse()
            peerHistory.ids.reverse()
    
            if (AppMessagesManager.regroupWrappedHistory(peerHistory.messages)) {
              $scope.$broadcast('messages_regroup')
            }
    
            if (historyResult.unreadOffset) {
              $scope.historyUnreadAfter = historyResult.history[historyResult.unreadOffset - 1]
            } else if ($scope.historyUnreadAfter) {
              delete $scope.historyUnreadAfter
            }
            $scope.$broadcast('messages_unread_after')
            var focusedMsgID = $scope.curDialog.messageID || 0
            onContentLoaded(function () {
              $scope.$broadcast('messages_focus', focusedMsgID)
            })
            $scope.$broadcast('ui_history_change')
    
            if (!$rootScope.idle.isIDLE) {
              AppMessagesManager.readHistory($scope.curDialog.peerID)
            }
    
            updateBotActions()
            updateChannelActions()
          }, function () {
            safeReplaceObject($scope.state, {error: true, loaded: true})
          })
        }
    
        function showEmptyHistory () {
          jump++
          safeReplaceObject($scope.historyPeer, {})
          safeReplaceObject($scope.state, {notSelected: true})
          peerHistory = false
          hasMore = false
    
          $scope.$broadcast('ui_history_change')
        }
    
        function startBot () {
          AppMessagesManager.startBot(peerID, 0, $scope.curDialog.startParam)
          $scope.curDialog.startParam = false
        }
    
        function cancelBot () {
          delete $scope.curDialog.startParam
        }
    
        function joinChannel () {
          MtpApiManager.invokeApi('channels.joinChannel', {
            channel: AppChatsManager.getChannelInput(-peerID)
          }).then(function (result) {
            ApiUpdatesManager.processUpdateMessage(result)
          })
        }
    
        function togglePeerMuted (muted) {
          NotificationsManager.getPeerSettings(peerID).then(function (settings) {
            settings.mute_until = !muted ? 0 : 2000000000
            NotificationsManager.updatePeerSettings(peerID, settings)
          })
        }
    
        function toggleMessage (messageID, $event) {
          if ($scope.historyState.botActions ||
            $rootScope.idle.afterFocus) {
            return false
          }
          var message = AppMessagesManager.getMessage(messageID)
          if (message._ == 'messageService') {
            return false
          }
    
          if (!$scope.historyState.selectActions) {
            if (getSelectedText()) {
              return false
            }
    
            var target = $event.target
            while (target) {
              if (target instanceof SVGElement) {
                target = target.parentNode
                continue
              }
              if (target.className && target.className.indexOf('im_message_outer_wrap') != -1) {
                if (Config.Mobile) {
                  return false
                }
                break
              }
              if (target.className &&
                target.className.indexOf('im_message_date') != -1) {
                if ($scope.historyFilter.mediaType) {
                  $rootScope.$broadcast('history_focus', {
                    peerString: $scope.curDialog.peer,
                    messageID: messageID
                  })
                  return
                }
                if (AppPeersManager.isBroadcast(peerID)) {
                  quickForward(messageID)
                } else {
                  selectedReply(messageID)
                }
                return false
              }
              if (Config.Mobile &&
                target.className &&
                target.className.indexOf('im_message_body') != -1) {
                break
              }
              if (target.tagName == 'A' || hasOnclick(target)) {
                return false
              }
              target = target.parentNode
            }
    
            if (Config.Mobile) {
              $scope.historyState.canEdit = AppMessagesManager.canEditMessage(messageID)
    
              $modal.open({
                templateUrl: templateUrl('message_actions_modal'),
                windowClass: 'message_actions_modal_window',
                scope: $scope.$new()
              }).result.then(function (action) {
                switch (action) {
                  case 'reply':
                    selectedReply(messageID)
                    break
    
                  case 'edit':
                    selectedEdit(messageID)
                    break
    
                  case 'delete':
                    selectedDelete(messageID)
                    break
    
                  case 'forward':
                    selectedForward(messageID)
                    break
    
                  case 'select':
                    $scope.historyState.selectActions = 'selected'
                    $scope.$broadcast('ui_panel_update')
                    toggleMessage(messageID)
                    break
                }
              })
              return false
            }
          }
    
          var shiftClick = $event && $event.shiftKey
          if (shiftClick) {
            $scope.$broadcast('ui_selection_clear')
          }
    
          if ($scope.selectedMsgs[messageID]) {
            lastSelectID = false
            delete $scope.selectedMsgs[messageID]
            $scope.selectedCount--
            if (!$scope.selectedCount) {
              $scope.historyState.selectActions = false
              $scope.$broadcast('ui_panel_update')
            }
          } else {
            if (!shiftClick) {
              lastSelectID = messageID
            } else if (lastSelectID != messageID) {
              var dir = lastSelectID > messageID
              var i, startPos, curMessageID
    
              for (i = 0; i < peerHistory.messages.length; i++) {
                if (peerHistory.messages[i].mid == lastSelectID) {
                  startPos = i
                  break
                }
              }
    
              i = startPos
              while (peerHistory.messages[i] &&
                (curMessageID = peerHistory.messages[i].mid) != messageID) {
                if (!$scope.selectedMsgs[curMessageID]) {
                  $scope.selectedMsgs[curMessageID] = true
                  $scope.selectedCount++
                }
                i += dir ? -1 : +1
              }
            }
    
            $scope.selectedMsgs[messageID] = true
            $scope.selectedCount++
            if (!$scope.historyState.selectActions) {
              $scope.historyState.selectActions = 'selected'
              $scope.$broadcast('ui_panel_update')
            }
          }
          if ($scope.selectedCount == 1) {
            angular.forEach($scope.selectedMsgs, function (t, messageID) {
              $scope.historyState.canEdit = AppMessagesManager.canEditMessage(messageID)
            })
          }
          $scope.$broadcast('messages_select')
        }
    
        function selectInlineBot (botID, $event) {
          if ($scope.historyState.canReply) {
            $scope.$broadcast('inline_bot_select', botID)
          }
          return cancelEvent($event)
        }
    
        function selectedCancel (noBroadcast) {
          $scope.selectedMsgs = {}
          $scope.selectedCount = 0
          $scope.historyState.selectActions = false
          lastSelectID = false
          if (!noBroadcast) {
            $scope.$broadcast('ui_panel_update')
          }
          $scope.$broadcast('messages_select')
        }
    
        function selectedFlush () {
          ErrorService.confirm({type: 'HISTORY_FLUSH'}).then(function () {
            AppMessagesManager.flushHistory($scope.curDialog.peerID, true).then(function () {
              selectedCancel()
            })
          })
        }
    
        function selectedDelete (selectedMessageID) {
          var selectedMessageIDs = []
          if (selectedMessageID) {
            selectedMessageIDs.push(selectedMessageID)
          } else if ($scope.selectedCount > 0) {
            angular.forEach($scope.selectedMsgs, function (t, messageID) {
              selectedMessageIDs.push(messageID)
            })
          }
          if (selectedMessageIDs.length) {
            var peerID = $scope.curDialog.peerID
            var isUser = peerID > 0
            var isChannel = AppPeersManager.isChannel(peerID)
            var isBroadcast = AppPeersManager.isBroadcast(peerID)
            var isMegagroup = AppPeersManager.isMegagroup(peerID)
            var isUsualGroup = !isChannel && !isUser
            var isSavedMessages = peerID == AppUsersManager.getSelf().id
    
            var revocable = !isChannel
            for (var i = 0; revocable && i < selectedMessageIDs.length; i++) {
              var messageID = selectedMessageIDs[i]
              if (!AppMessagesManager.canRevokeMessage(messageID)) {
                revocable = false
              }
            }
    
            ErrorService.confirm({
              type: 'MESSAGES_DELETE',
              count: selectedMessageIDs.length,
              revocable: revocable,
              isUser: isUser,
              peerID: peerID,
              isSavedMessages: isSavedMessages,
              isChannel: isBroadcast,
              isSupergroup: isMegagroup,
              isUsualGroup: isUsualGroup
            }, {}, { revoke: false }).then(function (data) {
              AppMessagesManager.deleteMessages(selectedMessageIDs, data.revoke).then(function () {
                selectedCancel()
              })
            })
          }
        }
    
        function quickForward (msgID) {
          PeersSelectService.selectPeers({
            canSend: true,
            confirm_type: 'FORWARD_PEER',
            shareLinkPromise: AppMessagesManager.getMessageShareLink(msgID)
          }).then(function (peerStrings) {
            angular.forEach(peerStrings, function (peerString) {
              var peerID = AppPeersManager.getPeerID(peerString)
              AppMessagesManager.forwardMessages(peerID, [msgID])
            })
            var toastData = toaster.pop({
              type: 'info',
              body: _('confirm_modal_forward_to_peer_success'),
              bodyOutputType: 'trustedHtml',
              clickHandler: function () {
                $rootScope.$broadcast('history_focus', {
                  peerString: peerStrings[0]
                })
                toaster.clear(toastData)
              },
              showCloseButton: false
            })
          })
        }
    
        function selectedForward (selectedMessageID) {
          var selectedMessageIDs = []
          if (selectedMessageID) {
            selectedMessageIDs.push(selectedMessageID)
          } else if ($scope.selectedCount > 0) {
            angular.forEach($scope.selectedMsgs, function (t, messageID) {
              selectedMessageIDs.push(messageID)
            })
          }
          if (selectedMessageIDs.length) {
            PeersSelectService.selectPeer({canSend: true}).then(function (peerStrings) {
              selectedCancel()
              if (Array.isArray(peerStrings) && peerStrings.length > 1) {
                angular.forEach(peerStrings, function (peerString) {
                  var peerID = AppPeersManager.getPeerID(peerString)
                  AppMessagesManager.forwardMessages(peerID, selectedMessageIDs)
                })
                var toastData = toaster.pop({
                  type: 'info',
                  body: _('confirm_modal_forward_to_peer_success'),
                  bodyOutputType: 'trustedHtml',
                  clickHandler: function () {
                    $rootScope.$broadcast('history_focus', {
                      peerString: peerStrings[0]
                    })
                    toaster.clear(toastData)
                  },
                  showCloseButton: false
                })
              } else {            
                $rootScope.$broadcast('history_focus', {
                  peerString: peerStrings,
                  attachment: {
                    _: 'fwd_messages',
                    id: selectedMessageIDs
                  }
                })
              }    
            })
          }
        }
    
        function selectedReply (selectedMessageID) {
          if (!selectedMessageID && $scope.selectedCount == 1) {
            angular.forEach($scope.selectedMsgs, function (t, messageID) {
              selectedMessageID = messageID
            })
          }
          if (selectedMessageID) {
            selectedCancel()
            $scope.$broadcast('reply_selected', selectedMessageID)
          }
        }
    
        function selectedEdit (selectedMessageID) {
          if (!selectedMessageID && $scope.selectedCount == 1) {
            angular.forEach($scope.selectedMsgs, function (t, messageID) {
              selectedMessageID = messageID
            })
          }
          if (selectedMessageID) {
            selectedCancel()
            $scope.$broadcast('edit_selected', selectedMessageID)
          }
        }
    
        function toggleEdit () {
          if ($scope.historyState.selectActions) {
            selectedCancel()
          } else {
            $scope.historyState.selectActions = 'selected'
            $scope.$broadcast('ui_panel_update')
          }
        }
    
        function toggleMedia (mediaType) {
          if (mediaType == 'search') {
            $rootScope.$broadcast('history_search', $scope.curDialog.peerID)
            return
          }
          $scope.historyFilter.mediaType = mediaType || false
          if (mediaType) {
            $scope.curDialog.messageID = false
          }
          peerHistory.messages = []
          peerHistory.ids = []
          $scope.state.empty = true
          loadHistory()
        }
    
        function returnToRecent () {
          if ($scope.historyFilter.mediaType) {
            toggleMedia()
          } else {
            if ($scope.curDialog.messageID) {
              $rootScope.$broadcast('history_focus', {peerString: $scope.curDialog.peer})
            } else {
              loadHistory(true)
            }
          }
        }
    
        $scope.$on('history_update', angular.noop)
    
        var loadAfterSync = false
        $scope.$on('stateSynchronized', function () {
          if (!loadAfterSync) {
            return
          }
          if (loadAfterSync == $scope.curDialog.peerID) {
            loadHistory()
          }
          loadAfterSync = false
        })
    
        $scope.$on('reply_button_press', function (e, button) {
          var replyKeyboard = $scope.historyState.replyKeyboard
          if (!replyKeyboard) {
            return
          }
          var sendOptions = {
            replyToMsgID: peerID < 0 && replyKeyboard.mid
          }
          switch (button._) {
            case 'keyboardButtonRequestPhone':
              ErrorService.confirm({type: 'BOT_ACCESS_PHONE'}).then(function () {
                var user = AppUsersManager.getSelf()
                AppMessagesManager.sendOther(peerID, {
                  _: 'inputMediaContact',
                  phone_number: user.phone,
                  first_name: user.first_name,
                  last_name: user.last_name
                }, sendOptions)
              })
              break
    
            case 'keyboardButtonRequestGeoLocation':
              ErrorService.confirm({type: 'BOT_ACCESS_GEO'}).then(function () {
                return GeoLocationManager.getPosition().then(function (coords) {
                  AppMessagesManager.sendOther(peerID, {
                    _: 'inputMediaGeoPoint',
                    geo_point: {
                      _: 'inputGeoPoint',
                      'lat': coords['lat'],
                      'long': coords['long']
                    }
                  }, sendOptions)
                }, function (error) {
                  ErrorService.alert(
                    _('error_modal_bad_request_title_raw'),
                    _('error_modal_gelocation_na_raw')
                  )
                })
              })
              break
    
            default:
              AppMessagesManager.sendText(peerID, button.text, sendOptions)
          }
        })
    
        $scope.$on('history_reload', function (e, updPeerID) {
          if (updPeerID == $scope.curDialog.peerID) {
            loadHistory()
          }
        })
    
        $scope.$on('history_forbidden', function (e, updPeerID) {
          if (updPeerID == $scope.curDialog.peerID) {
            $location.url('/im')
          }
          historiesQueuePop(updPeerID)
        })
    
        $scope.$on('dialog_migrate', function (e, data) {
          if (data.migrateFrom == $scope.curDialog.peerID) {
            var peerString = AppPeersManager.getPeerString(data.migrateTo)
            $rootScope.$broadcast('history_focus', {peerString: peerString})
          }
          historiesQueuePop(data.migrateFrom)
        })
    
        $scope.$on('notify_settings', function (e, data) {
          if (data.peerID == $scope.curDialog.peerID) {
            updateChannelActions()
          }
        })
    
        $scope.$on('channel_settings', function (e, data) {
          if (data.channelID == -$scope.curDialog.peerID) {
            updateChannelActions()
          }
        })
    
        var typingTimeouts = {}
        $scope.$on('history_append', function (e, addedMessage) {
          var history = historiesQueueFind(addedMessage.peerID)
          if (!history) {
            return
          }
          var curPeer = addedMessage.peerID == $scope.curDialog.peerID
          if (curPeer) {
            if ($scope.historyFilter.mediaType ||
              $scope.historyState.skipped) {
              if (addedMessage.my) {
                returnToRecent()
              } else {
                $scope.historyState.missedCount++
              }
              return
            }
            if ($scope.curDialog.messageID && addedMessage.my) {
              returnToRecent()
            }
            delete $scope.state.empty
          }
          // console.log('append', addedMessage)
          // console.trace()
          var historyMessage = AppMessagesManager.wrapForHistory(addedMessage.messageID)
          history.messages.push(historyMessage)
          history.ids.push(addedMessage.messageID)
          if (AppMessagesManager.regroupWrappedHistory(history.messages, -3)) {
            $scope.$broadcast('messages_regroup')
          }
    
          if (curPeer) {
            $scope.historyState.typing.splice(0, $scope.historyState.typing.length)
            $scope.$broadcast('ui_history_append_new', {
              my: addedMessage.my,
              idleScroll: unreadAfterIdle && !historyMessage.pFlags.out && $rootScope.idle.isIDLE
            })
            if (addedMessage.my && $scope.historyUnreadAfter) {
              delete $scope.historyUnreadAfter
              $scope.$broadcast('messages_unread_after')
            }
    
            // console.log('append check', $rootScope.idle.isIDLE, addedMessage.peerID, $scope.curDialog.peerID, historyMessage, history.messages[history.messages.length - 2])
            if ($rootScope.idle.isIDLE) {
              if (historyMessage.pFlags.unread &&
                !historyMessage.pFlags.out &&
                !(history.messages[history.messages.length - 2] || {}).pFlags.unread) {
                $scope.historyUnreadAfter = historyMessage.mid
                unreadAfterIdle = true
                $scope.$broadcast('messages_unread_after')
              }
            } else {
              $timeout(function () {
                AppMessagesManager.readHistory($scope.curDialog.peerID)
              })
            }
    
            updateBotActions()
            updateChannelActions()
          }
        })
    
        $scope.$on('history_multiappend', function (e, historyMultiAdded) {
          // console.log(dT(), 'multiappend', angular.copy(historyMultiAdded))
          var regroupped = false
          var unreadAfterChanged = false
          var isIDLE = $rootScope.idle.isIDLE
          angular.forEach(historyMultiAdded, function (msgs, peerID) {
            var history = historiesQueueFind(peerID)
            // var history = historiesQueuePush(peerID)
            if (!history) {
              return
            }
            var curPeer = peerID == $scope.curDialog.peerID
            var exlen = history.messages.length
            var len = msgs.length
    
            if (curPeer) {
              if ($scope.historyFilter.mediaType ||
                $scope.historyState.skipped) {
                $scope.historyState.missedCount += len
                return
              }
              delete $scope.state.empty
            }
    
            if ((!curPeer || isIDLE) &&
              exlen > (len > 10 ? 10 : 100)) {
              console.warn(dT(), 'Drop too many messages', len, exlen, isIDLE, curPeer, peerID)
              if (curPeer) {
                minID = history.messages[exlen - 1].mid
                $scope.historyState.skipped = hasLess = minID > 0
                if (hasLess) {
                  loadAfterSync = peerID
                  $scope.$broadcast('ui_history_append')
                }
              } else {
                historiesQueuePop(peerID)
              }
              return
            }
    
            var messageID, i
            var hasOut = false
            var unreadAfterNew = false
            var historyMessage = history.messages[history.messages.length - 1]
            var lastIsRead = !historyMessage || !historyMessage.pFlags.unread
            for (i = 0; i < len; i++) {
              messageID = msgs[i]
              if (messageID > 0 && messageID < maxID ||
                  history.ids.indexOf(messageID) !== -1) {
                continue
              }
              historyMessage = AppMessagesManager.wrapForHistory(messageID)
              history.messages.push(historyMessage)
              history.ids.push(messageID)
              if (!unreadAfterNew && isIDLE) {
                if (historyMessage.pFlags.unread &&
                  !historyMessage.pFlags.out &&
                  lastIsRead) {
                  unreadAfterNew = messageID
                } else {
                  lastIsRead = !historyMessage.pFlags.unread
                }
              }
              if (!hasOut && historyMessage.pFlags.out) {
                hasOut = true
              }
            }
            // console.log('after append', angular.copy(history.messages), angular.copy(history.ids))
    
            if (AppMessagesManager.regroupWrappedHistory(history.messages, -len - 2)) {
              regroupped = true
            }
    
            if (curPeer) {
              if ($scope.historyState.typing.length) {
                $scope.historyState.typing.splice(0, $scope.historyState.typing.length)
              }
              $scope.$broadcast('ui_history_append_new', {
                idleScroll: unreadAfterIdle && !hasOut && isIDLE
              })
    
              if (isIDLE) {
                if (unreadAfterNew) {
                  $scope.historyUnreadAfter = unreadAfterNew
                  unreadAfterIdle = true
                  unreadAfterChanged = true
                }
              } else {
                $timeout(function () {
                  AppMessagesManager.readHistory($scope.curDialog.peerID)
                })
              }
    
              updateBotActions()
              updateChannelActions()
            }
          })
    
          if (regroupped) {
            $scope.$broadcast('messages_regroup')
          }
          if (unreadAfterChanged) {
            $scope.$broadcast('messages_unread_after')
          }
        })
    
        $scope.$on('history_delete', function (e, historyUpdate) {
          var history = historiesQueueFind(historyUpdate.peerID)
          if (!history) {
            return
          }
          var newMessages = []
          var i
    
          for (i = 0; i < history.messages.length; i++) {
            if (!historyUpdate.msgs[history.messages[i].mid]) {
              newMessages.push(history.messages[i])
            }
          }
          history.messages = newMessages
          AppMessagesManager.regroupWrappedHistory(history.messages)
          $scope.$broadcast('messages_regroup')
          if (historyUpdate.peerID == $scope.curDialog.peerID) {
            $scope.state.empty = !newMessages.length
            updateBotActions()
          }
        })
    
        $scope.$on('dialog_flush', function (e, dialog) {
          var history = historiesQueueFind(dialog.peerID)
          if (history) {
            history.messages = []
            history.ids = []
            if (dialog.peerID == $scope.curDialog.peerID) {
              $scope.state.empty = true
              updateBotActions()
            }
          }
        })
    
        $scope.$on('history_focus', function (e, peerData) {
          if ($scope.historyFilter.mediaType) {
            toggleMedia()
          }
        })
    
        $scope.$on('apiUpdate', function (e, update) {
          switch (update._) {
            case 'updateUserTyping':
            case 'updateChatUserTyping':
              AppUsersManager.forceUserOnline(update.user_id)
              if (AppUsersManager.hasUser(update.user_id) &&
                $scope.curDialog.peerID == (update._ == 'updateUserTyping'
                  ? update.user_id
                  : -update.chat_id
                )) {
                if ($scope.historyState.typing.indexOf(update.user_id) == -1) {
                  $scope.historyState.typing.push(update.user_id)
                }
                $timeout.cancel(typingTimeouts[update.user_id])
    
                typingTimeouts[update.user_id] = $timeout(function () {
                  var pos = $scope.historyState.typing.indexOf(update.user_id)
                  if (pos !== -1) {
                    $scope.historyState.typing.splice(pos, 1)
                  }
                }, 6000)
              }
              break
          }
        })
    
        $scope.$on('history_need_less', showLessHistory)
        $scope.$on('history_need_more', showMoreHistory)
    
        $rootScope.$watch('idle.isIDLE', function (newVal) {
          if (!newVal &&
              $scope.curDialog &&
              $scope.curDialog.peerID &&
              !$scope.historyFilter.mediaType &&
              !$scope.historyState.skipped) {
            AppMessagesManager.readHistory($scope.curDialog.peerID)
          }
          if (!newVal) {
            unreadAfterIdle = false
            if (loadAfterSync &&
              loadAfterSync == $scope.curDialog.peerID) {
              loadHistory()
              loadAfterSync = false
            }
          }
        })
    }

})()
