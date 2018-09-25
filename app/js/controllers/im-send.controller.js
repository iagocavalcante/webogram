(function () {
    'use strict'
    angular
        .module('im-send.controller', ['myApp.i18n'])
        .controller('AppImSendController', AppImSendController)

    function AppImSendController ( $rootScope, $q, $scope, $timeout, MtpApiManager, Storage, AppProfileManager, AppChatsManager, AppUsersManager, AppPeersManager, AppDocsManager, AppStickersManager, AppMessagesManager, AppInlineBotsManager, MtpApiFileManager, DraftsManager, RichTextProcessor ) {
        $scope.$watch('curDialog.peer', resetDraft)
        $scope.$on('user_update', angular.noop)
        $scope.$on('peer_draft_attachment', applyDraftAttachment)
        $scope.$on('reply_selected', function (e, messageID) {
          replySelect(messageID, true)
        })
        $scope.$on('edit_selected', function (e, messageID) {
          setEditDraft(messageID, true)
        })
    
        $scope.$on('ui_typing', onTyping)
    
        $scope.draftMessage = {
          text: '',
          send: submitMessage,
          replyClear: replyClear,
          fwdsClear: fwdsClear,
          toggleSlash: toggleSlash,
          replyKeyboardToggle: replyKeyboardToggle,
          type: 'new'
        }
        $scope.mentions = {}
        $scope.commands = {}
        $scope.$watch('draftMessage.text', onMessageChange)
        $scope.$watch('draftMessage.files', onFilesSelected)
        $scope.$watch('draftMessage.sticker', onStickerSelected)
        $scope.$watch('draftMessage.command', onCommandSelected)
        $scope.$watch('draftMessage.inlineResultID', onInlineResultSelected)
    
        $scope.$on('history_reply_markup', function (e, peerData) {
          if (peerData.peerID == $scope.curDialog.peerID) {
            updateReplyKeyboard()
          }
        })
    
        $scope.$on('inline_bot_select', function (e, botID) {
          var bot = AppUsersManager.getUser(botID)
          $scope.draftMessage.text = '@' + bot.username + ' '
          $scope.$broadcast('ui_peer_draft', {focus: true})
        })
    
        $scope.$on('inline_bots_popular', updateMentions)
    
        $scope.$on('last_message_edit', setEditLastMessage)
    
        $rootScope.$watch('idle.isIDLE', function (newVal) {
          if ($rootScope.idle.initial) {
            return
          }
          if (newVal && $scope.curDialog.peerID) {
            $scope.$broadcast('ui_message_before_send')
            $timeout(function () {
              DraftsManager.syncDraft($scope.curDialog.peerID)
            })
          }
        })
    
        $scope.$on('draft_updated', function (e, draftUpdate) {
          if (draftUpdate.peerID == $scope.curDialog.peerID &&
              !draftUpdate.local &&
              (!$scope.draftMessage.text || $rootScope.idle.isIDLE)) {
            getDraft()
          }
        })
    
        var replyToMarkup = false
        var forceDraft = false
        var editMessageID = false
    
        function submitMessage (e) {
          $scope.$broadcast('ui_message_before_send')
    
          $timeout(function () {
            if (editMessageID) {
              editMessage()
            } else {
              sendMessage()
            }
          })
    
          return cancelEvent(e)
        }
    
        function sendMessage () {
          var text = $scope.draftMessage.text
    
          if (angular.isString(text) && text.length > 0) {
            text = RichTextProcessor.parseEmojis(text)
    
            var options = {
              replyToMsgID: $scope.draftMessage.replyToMsgID,
              clearDraft: true
            }
            do {
              AppMessagesManager.sendText($scope.curDialog.peerID, text.substr(0, 4096), options)
              text = text.substr(4096)
              options = angular.copy(options)
              delete options.clearDraft
            } while (text.length)
          }
          fwdsSend()
    
          if (forceDraft == $scope.curDialog.peer) {
            forceDraft = false
          }
    
          resetDraft()
          $scope.$broadcast('ui_message_send')
        }
    
        function editMessage () {
          var text = $scope.draftMessage.text
          text = RichTextProcessor.parseEmojis(text)
    
          AppMessagesManager.editMessage(editMessageID, text).then(function () {
            editMessageID = false
    
            resetDraft()
            $scope.$broadcast('ui_message_send')
            $timeout(function () {
              $scope.$broadcast('ui_peer_reply')
            })
          })
        }
    
        function updateMentions () {
          var peerID = $scope.curDialog.peerID
    
          if (!peerID) {
            safeReplaceObject($scope.mentions, {})
            $scope.$broadcast('mentions_update')
            return
          }
    
          var mentionUsers = []
          var mentionIndex = SearchIndexManager.createIndex()
    
          var inlineBotsPromise = AppInlineBotsManager.getPopularBots().then(function (inlineBots) {
            var ids = []
            angular.forEach(inlineBots, function (bot) {
              ids.push(bot.id)
            })
            return ids
          })
          var chatParticipantsPromise
          if (peerID < 0 && !AppPeersManager.isBroadcast(peerID)) {
            if (AppPeersManager.isChannel(peerID)) {
              chatParticipantsPromise = AppProfileManager.getChannelParticipants(-peerID)
            } else {
              chatParticipantsPromise = AppProfileManager.getChatFull(-peerID).then(function (chatFull) {
                return (chatFull.participants || {}).participants || []
              })
            }
            chatParticipantsPromise = chatParticipantsPromise.then(function (participantsVector) {
              var ids = []
              angular.forEach(participantsVector, function (participant) {
                ids.push(participant.user_id)
              })
              return ids
            })
          } else {
            chatParticipantsPromise = $q.when([])
          }
    
          $q.all({pop: inlineBotsPromise, chat: chatParticipantsPromise}).then(function (result) {
            var done = {}
            var ids = result.pop.concat(result.chat)
            angular.forEach(ids, function (userID) {
              if (done[userID]) {
                return
              }
              done[userID] = true
              mentionUsers.push(AppUsersManager.getUser(userID))
              SearchIndexManager.indexObject(userID, AppUsersManager.getUserSearchText(userID), mentionIndex)
            })
    
            safeReplaceObject($scope.mentions, {
              users: mentionUsers,
              index: mentionIndex
            })
            $scope.$broadcast('mentions_update')
          })
        }
    
        function updateCommands () {
          var peerID = $scope.curDialog.peerID
          if (!peerID) {
            safeReplaceObject($scope.commands, {})
            $scope.$broadcast('mentions_update')
            return
          }
    
          AppProfileManager.getPeerBots(peerID).then(function (peerBots) {
            if (!peerBots.length) {
              safeReplaceObject($scope.commands, {})
              $scope.$broadcast('mentions_update')
              return
            }
    
            var needMentions = peerID < 0
            var commandsList = []
            var commandsIndex = SearchIndexManager.createIndex()
    
            angular.forEach(peerBots, function (peerBot) {
              var mention = ''
              if (needMentions) {
                var bot = AppUsersManager.getUser(peerBot.id)
                if (bot && bot.username) {
                  mention += '@' + bot.username
                }
              }
              var botSearchText = AppUsersManager.getUserSearchText(peerBot.id)
              angular.forEach(peerBot.commands, function (description, command) {
                var value = '/' + command + mention
                commandsList.push({
                  botID: peerBot.id,
                  value: value,
                  rDescription: RichTextProcessor.wrapRichText(description, {noLinks: true, noLineBreaks: true})
                })
                SearchIndexManager.indexObject(value, botSearchText + ' ' + command + ' ' + description, commandsIndex)
              })
            })
    
            safeReplaceObject($scope.commands, {
              list: commandsList,
              index: commandsIndex
            })
            $scope.$broadcast('mentions_update')
          })
        }
    
        function resetDraft (newPeer, prevPeer) {
          var prevPeerID = prevPeer ? AppPeersManager.getPeerID(prevPeer) : 0
          if (newPeer != prevPeer && prevPeerID) {
            $scope.$broadcast('ui_message_before_send')
            $timeout(function () {
              DraftsManager.syncDraft(prevPeerID)
              resetDraft()
            })
            return
          }
    
          editMessageID = false
    
          updateMentions()
          updateCommands()
          replyClear()
          updateReplyKeyboard()
    
          delete $scope.draftMessage.inlineProgress
          $scope.$broadcast('inline_results', false)
    
          // console.log(dT(), 'reset draft', $scope.curDialog.peer, forceDraft)
          if (forceDraft) {
            if (forceDraft == $scope.curDialog.peer) {
              $scope.draftMessage.isBroadcast = AppPeersManager.isBroadcast($scope.curDialog.peerID)
              $scope.$broadcast('ui_peer_draft')
              return
            } else {
              forceDraft = false
            }
          }
    
          fwdsClear()
          getDraft()
        }
    
        function getDraft () {
          if ($scope.curDialog.peerID) {
            var draftDataPromise
            if (editMessageID) {
              draftDataPromise = AppMessagesManager.getMessageEditData(editMessageID).then(function (draftData) {
                draftData.replyToMsgID = editMessageID
                return draftData
              }, function (error) {
                console.warn(error)
                editMessageID = false
                getDraft()
                return $q.reject()
              })
            } else {
              draftDataPromise = DraftsManager.getDraft($scope.curDialog.peerID)
            }
            draftDataPromise.then(function (draftData) {
              $scope.draftMessage.type = editMessageID ? 'edit' : 'new'
              $scope.draftMessage.text = draftData ? draftData.text : ''
              $scope.draftMessage.isBroadcast = AppPeersManager.isBroadcast($scope.curDialog.peerID)
              if (draftData.replyToMsgID) {
                var replyToMsgID = draftData.replyToMsgID
                replySelect(replyToMsgID)
              } else {
                replyClear()
              }
              $scope.$broadcast('ui_peer_draft')
            })
          } else {
            // console.log('Reset peer')
            $scope.draftMessage.text = ''
            $scope.$broadcast('ui_peer_draft')
          }
        }
    
        function applyDraftAttachment (e, attachment) {
          console.log(dT(), 'apply draft attach', attachment)
          if (!attachment || !attachment._) {
            return
          }
    
          if (attachment._ == 'share_url') {
            var url = attachment.url
            var text = attachment.text || ' '
            forceDraft = $scope.curDialog.peer
    
            $timeout(function () {
              $scope.draftMessage.text = url + '\n' + text
              $scope.$broadcast('ui_peer_draft', {
                customSelection: [
                  url + '\n',
                  text,
                  ''
                ]
              })
            }, 1000)
          } else if (attachment._ == 'fwd_messages') {
            forceDraft = $scope.curDialog.peer
            $timeout(function () {
              $scope.draftMessage.fwdMessages = attachment.id
              $scope.$broadcast('ui_peer_reply')
            }, 100)
          } else if (attachment._ == 'inline_query') {
            var mention = attachment.mention
            var query = attachment.query
            forceDraft = $scope.curDialog.peer
    
            $timeout(function () {
              $scope.draftMessage.text = mention + ' ' + query
              $scope.$broadcast('ui_peer_draft', {
                customSelection: [
                  mention + ' ' + query,
                  '',
                  ''
                ]
              })
            }, 1000)
          }
        }
    
        function replySelect (messageID, byUser) {
          if (editMessageID && byUser) {
            replyClear()
            return
          }
          $scope.draftMessage.replyToMsgID = messageID
          $scope.$broadcast('ui_peer_reply')
          replyToMarkup = false
    
          if (byUser && !editMessageID) {
            DraftsManager.changeDraft($scope.curDialog.peerID, {
              text: $scope.draftMessage.text,
              replyToMsgID: messageID
            })
          }
        }
    
        function setEditDraft (messageID) {
          editMessageID = messageID
          getDraft()
        }
    
        function setEditLastMessage () {
          if (editMessageID ||
              !$scope.curDialog.peerID) {
            return false
          }
          AppMessagesManager.getHistory($scope.curDialog.peerID).then(function (historyResult) {
            for (var i = 0, messageID; i < historyResult.history.length; i++) {
              messageID = historyResult.history[i]
              if (AppMessagesManager.canEditMessage(messageID)) {
                setEditDraft(messageID)
                break
              }
            }
          })
        }
    
        function replyClear (byUser) {
          if (editMessageID) {
            editMessageID = false
            getDraft()
            return
          }
          var mid = $scope.draftMessage.replyToMsgID
          if (mid &&
            $scope.historyState.replyKeyboard &&
            $scope.historyState.replyKeyboard.mid == mid &&
            !$scope.historyState.replyKeyboard.pFlags.hidden) {
            $scope.historyState.replyKeyboard.pFlags.hidden = true
            $scope.$broadcast('ui_keyboard_update')
          }
          delete $scope.draftMessage.replyToMsgID
          $scope.$broadcast('ui_peer_reply')
    
          if (byUser) {
            DraftsManager.changeDraft($scope.curDialog.peerID, {
              text: $scope.draftMessage.text
            })
          }
        }
    
        function fwdsClear () {
          if ($scope.draftMessage.fwdMessages &&
            $scope.draftMessage.fwdMessages.length) {
            delete $scope.draftMessage.fwdMessages
            $scope.$broadcast('ui_peer_reply')
    
            if (forceDraft == $scope.curDialog.peer) {
              forceDraft = false
            }
          }
        }
    
        function fwdsSend () {
          if ($scope.draftMessage.fwdMessages &&
            $scope.draftMessage.fwdMessages.length) {
            var ids = $scope.draftMessage.fwdMessages.slice()
            fwdsClear()
            setZeroTimeout(function () {
              AppMessagesManager.forwardMessages($scope.curDialog.peerID, ids)
            })
          }
        }
    
        function toggleSlash ($event) {
          if ($scope.draftMessage.text &&
            $scope.draftMessage.text.charAt(0) == '/') {
            $scope.draftMessage.text = ''
          } else {
            $scope.draftMessage.text = '/'
          }
          $scope.$broadcast('ui_peer_draft', {focus: true})
          return cancelEvent($event)
        }
    
        function updateReplyKeyboard () {
          var peerID = $scope.curDialog.peerID
          var replyKeyboard = AppMessagesManager.getReplyKeyboard(peerID)
          if (replyKeyboard) {
            replyKeyboard = AppMessagesManager.wrapReplyMarkup(replyKeyboard)
          }
          // console.log('update reply markup', peerID, replyKeyboard)
          $scope.historyState.replyKeyboard = replyKeyboard
    
          var addReplyMessage =
          replyKeyboard &&
            !replyKeyboard.pFlags.hidden &&
            (replyKeyboard._ == 'replyKeyboardForceReply' ||
            (replyKeyboard._ == 'replyKeyboardMarkup' && peerID < 0))
    
          if (addReplyMessage) {
            replySelect(replyKeyboard.mid)
            replyToMarkup = true
          } else if (replyToMarkup) {
            replyClear()
          }
          var enabled = replyKeyboard &&
            !replyKeyboard.pFlags.hidden &&
            replyKeyboard._ == 'replyKeyboardMarkup'
          $scope.$broadcast('ui_keyboard_update', {enabled: enabled})
          $scope.$emit('ui_panel_update', {blur: enabled})
        }
    
        function replyKeyboardToggle ($event) {
          var replyKeyboard = $scope.historyState.replyKeyboard
          if (replyKeyboard) {
            replyKeyboard.pFlags.hidden = !replyKeyboard.pFlags.hidden
            updateReplyKeyboard()
          }
          return cancelEvent($event)
        }
    
        function onMessageChange (newVal, prevVal, a) {
          // console.log('ctrl text changed', newVal, prevVal);
          if (newVal === '' && prevVal === '') {
            return
          }
    
          if (newVal && newVal.length) {
            if (!$scope.historyFilter.mediaType && !$scope.historyState.skipped) {
              AppMessagesManager.readHistory($scope.curDialog.peerID)
            }
          }
          if ($scope.curDialog.peerID) {
            if (!editMessageID) {
              var replyToMsgID = $scope.draftMessage.replyToMsgID
              if (replyToMsgID &&
                  $scope.historyState.replyKeyboard &&
                  $scope.historyState.replyKeyboard.mid == replyToMsgID) {
                replyToMsgID = 0
              }
              DraftsManager.changeDraft($scope.curDialog.peerID, {
                text: newVal,
                replyToMsgID: replyToMsgID
              })
            }
            checkInlinePattern(newVal)
          }
        }
    
        var inlineUsernameRegex = /^@([a-zA-Z\d_]{1,32})( | )([\s\S]*)$/
        var inlineStickersEmojiRegex = /^\s*:(\S+):\s*$/
        var getInlineResultsTO = false
        var lastInlineBot = false
        var jump = 0
    
        function checkInlinePattern (message) {
          if (getInlineResultsTO) {
            $timeout.cancel(getInlineResultsTO)
          }
          var curJump = ++jump
          if (!message || !message.length) {
            delete $scope.draftMessage.inlineProgress
            $scope.$broadcast('inline_results', false)
            return
          }
          var matches = message.match(inlineUsernameRegex)
          if (!matches) {
            matches = message.match(inlineStickersEmojiRegex)
            if (matches) {
              var emojiCode = EmojiHelper.shortcuts[matches[1]]
              if (emojiCode) {
                $scope.draftMessage.inlineProgress = true
                AppStickersManager.searchStickers(emojiCode).then(function (docs) {
                  var inlineResults = []
                  angular.forEach(docs, function (doc) {
                    inlineResults.push({
                      _: 'botInlineMediaResult',
                      qID: '_sticker_' + doc.id,
                      pFlags: {sticker: true},
                      id: doc.id,
                      type: 'sticker',
                      document: doc,
                      send_message: {_: 'botInlineMessageMediaAuto'}
                    })
                  })
                  var botResults = {
                    pFlags: {gallery: true},
                    query_id: 0,
                    results: inlineResults
                  }
                  botResults.text = message
                  $scope.$broadcast('inline_results', botResults)
                  delete $scope.draftMessage.inlineProgress
                })
              } else {
                delete $scope.draftMessage.inlineProgress
                $scope.$broadcast('inline_results', false)
                return
              }
            }
            delete $scope.draftMessage.inlineProgress
            $scope.$broadcast('inline_results', false)
            return
          }
          var username = matches[1]
          var inlineBotPromise
          $scope.draftMessage.inlineProgress = true
          if (lastInlineBot && lastInlineBot.username == username) {
            inlineBotPromise = $q.when(lastInlineBot)
          } else {
            inlineBotPromise = AppInlineBotsManager.resolveInlineMention(username)
          }
          inlineBotPromise.then(function (inlineBot) {
            if (curJump != jump) {
              return
            }
            lastInlineBot = inlineBot
            $scope.$broadcast('inline_placeholder', {
              prefix: '@' + username + matches[2],
              placeholder: inlineBot.placeholder
            })
            if (getInlineResultsTO) {
              $timeout.cancel(getInlineResultsTO)
            }
            getInlineResultsTO = $timeout(function () {
              var query = RichTextProcessor.parseEmojis(matches[3])
              AppInlineBotsManager.getInlineResults($scope.curDialog.peerID, inlineBot.id, query, inlineBot.geo, '').then(function (botResults) {
                getInlineResultsTO = false
                if (curJump != jump) {
                  return
                }
                botResults.text = message
                $scope.$broadcast('inline_results', botResults)
                delete $scope.draftMessage.inlineProgress
              }, function () {
                $scope.$broadcast('inline_results', false)
                delete $scope.draftMessage.inlineProgress
              })
            }, 500)
          }, function (error) {
            $scope.$broadcast('inline_results', false)
            delete $scope.draftMessage.inlineProgress
          })
        }
    
        function onTyping () {
          if (AppPeersManager.isBroadcast($scope.curDialog.peerID)) {
            return false
          }
          MtpApiManager.invokeApi('messages.setTyping', {
            peer: AppPeersManager.getInputPeerByID($scope.curDialog.peerID),
            action: {_: 'sendMessageTypingAction'}
          })['catch'](function (error) {
            error.handled = true
          })
        }
    
        function onFilesSelected (newVal) {
          if (!angular.isArray(newVal) || !newVal.length) {
            return
          }
          var options = {
            replyToMsgID: $scope.draftMessage.replyToMsgID,
            isMedia: $scope.draftMessage.isMedia
          }
    
          delete $scope.draftMessage.replyToMsgID
    
          if (newVal[0].lastModified) {
            newVal.sort(function (file1, file2) {
              return file1.lastModified - file2.lastModified
            })
          }
    
          for (var i = 0; i < newVal.length; i++) {
            AppMessagesManager.sendFile($scope.curDialog.peerID, newVal[i], options)
            $scope.$broadcast('ui_message_send')
          }
          fwdsSend()
        }
    
        function onStickerSelected (newVal) {
          if (!newVal) {
            return
          }
    
          var doc = AppDocsManager.getDoc(newVal)
          if (doc.id && doc.access_hash) {
            var inputMedia = {
              _: 'inputMediaDocument',
              id: {
                _: 'inputDocument',
                id: doc.id,
                access_hash: doc.access_hash
              }
            }
            var options = {
              replyToMsgID: $scope.draftMessage.replyToMsgID
            }
            AppMessagesManager.sendOther($scope.curDialog.peerID, inputMedia, options)
            $scope.$broadcast('ui_message_send')
    
            fwdsSend()
            replyClear(true)
          }
          delete $scope.draftMessage.sticker
        }
    
        function onCommandSelected (command) {
          if (!command) {
            return
          }
          AppMessagesManager.sendText($scope.curDialog.peerID, command, {
            clearDraft: true
          })
    
          if (forceDraft == $scope.curDialog.peer) {
            forceDraft = false
          }
    
          fwdsSend()
          resetDraft()
          delete $scope.draftMessage.sticker
          delete $scope.draftMessage.text
          delete $scope.draftMessage.command
          delete $scope.draftMessage.inlineResultID
          $scope.$broadcast('ui_message_send')
          $scope.$broadcast('ui_peer_draft')
        }
    
        function onInlineResultSelected (qID) {
          if (!qID) {
            return
          }
    
          if (qID.substr(0, 11) == '_switch_pm_') {
            var botID = lastInlineBot.id
            var startParam = qID.substr(11)
            return AppInlineBotsManager.switchToPM($scope.curDialog.peerID, botID, startParam)
          }
    
          var options = {
            replyToMsgID: $scope.draftMessage.replyToMsgID,
            clearDraft: true
          }
    
          if (qID.substr(0, 9) == '_sticker_') {
            var docID = qID.substr(9)
            var doc = AppDocsManager.getDoc(docID)
            if (doc.id && doc.access_hash) {
              var inputMedia = {
                _: 'inputMediaDocument',
                id: {
                  _: 'inputDocument',
                  id: doc.id,
                  access_hash: doc.access_hash
                }
              }
              AppMessagesManager.sendOther($scope.curDialog.peerID, inputMedia, options)
            }
          }
          else {
            AppInlineBotsManager.sendInlineResult($scope.curDialog.peerID, qID, options)
          }
    
    
          if (forceDraft == $scope.curDialog.peer) {
            forceDraft = false
          }
    
          fwdsSend()
          resetDraft()
          delete $scope.draftMessage.sticker
          delete $scope.draftMessage.text
          delete $scope.draftMessage.command
          delete $scope.draftMessage.inlineResultID
          $scope.$broadcast('ui_message_send')
          $scope.$broadcast('ui_peer_draft')
        }
    }

})()
