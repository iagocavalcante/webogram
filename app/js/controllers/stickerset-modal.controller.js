(function () {
  'use strict'
  angular
    .module('stickerset-modal.controller', ['myApp.i18n'])
    .controller('StickersetModalController', StickersetModalController)

  function StickersetModalController ( $scope, $rootScope, $modalInstance, MtpApiManager, RichTextProcessor, AppStickersManager, AppDocsManager, AppMessagesManager, LocationParamsService ) {
    $scope.slice = {limit: 20, limitDelta: 20}

    var fullSet

    AppStickersManager.getStickerset($scope.inputStickerset).then(function (result) {
      $scope.$broadcast('ui_height')
      $scope.stickersetLoaded = true
      fullSet = result
      $scope.stickerset = result.set
      $scope.stickersetInstalled = result.set.pFlags.installed == true
      $scope.documents = result.documents

      $scope.stickerEmojis = {}
      $scope.stickerDimensions = {}
      angular.forEach($scope.documents, function (doc) {
        $scope.stickerEmojis[doc.id] = RichTextProcessor.wrapRichText(doc.stickerEmojiRaw, {
          noLinks: true,
          noLinebreaks: true,
          emojiIconSize: 26
        })
        var dim = calcImageInBox(doc.w, doc.h, 192, 192)
        $scope.stickerDimensions[doc.id] = {width: dim.w, height: dim.h}
      })
    })

    $scope.toggleInstalled = function (installed) {
      AppStickersManager.installStickerset(fullSet, !installed).then(function () {
        $scope.stickersetInstalled = installed
      })
    }

    $scope.chooseSticker = function (docID) {
      var doc = AppDocsManager.getDoc(docID)
      if (!doc.id || !doc.access_hash || !$rootScope.selectedPeerID) {
        return
      }
      var inputMedia = {
        _: 'inputMediaDocument',
        id: {
          _: 'inputDocument',
          id: doc.id,
          access_hash: doc.access_hash
        }
      }
      AppMessagesManager.sendOther($rootScope.selectedPeerID, inputMedia)
      $modalInstance.close(doc.id)
    }

    $scope.share = function () {
      LocationParamsService.shareUrl('https://t.me/addstickers/' + $scope.stickerset.short_name, $scope.stickerset.title)
    }
  }

})()
