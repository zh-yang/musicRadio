//设置事件中心，使用发布订阅模式
var EventCenter = {
  on: function(type, handler) {
    $(document).on(type, handler)
  },
  fire: function(type, data) {
    $(document).trigger(type, data)
  }
  //如果需要可以添加 delete 用来删除事件。
}

//使用范例
// EventCenter.on('hello', function(e, data){
//   console.log(data)
// })

// EventCenter.fire('hello', '你好')


/*----------初始化Footer-----------*/
var Footer = {
  init: function() {
    this.$footer = $('footer')  
    this.$ul = this.$footer.find('ul')
    this.$box = this.$footer.find('.box')
    this.$leftBtn = this.$footer.find('.icon-left')
    this.$rightBtn = this.$footer.find('.icon-right')
    this.isToEnd = false
    this.isToStart = true
    this.isAnimate = false  //防止重复点击

    this.bind()  //绑定事件
    this.render()  //初始化渲染
  },

  bind: function() {
    var _this = this
    //右侧滚动
    this.$rightBtn.on('click', function() {
      if (_this.isAnimate) return

      var itemWidth = _this.$box.find('li').outerWidth(true)
      var rowCount = Math.floor(_this.$box.width() / itemWidth)
      if (!_this.isToEnd) {
        _this.isAnimate = true
        _this.$ul.animate({
          left: '-=' + rowCount * itemWidth
        }, 400, function() {
          _this.isAnimate = false
          _this.isToStart = false
          if (parseFloat(_this.$box.width()) - parseFloat(_this.$ul.css('left')) >= parseFloat(_this.$ul.css('width'))) {
            _this.isToEnd = true
          }
        })
      }
    })

    //左侧滚动
    this.$leftBtn.on('click', function() {
      if (_this.isAnimate) return
      var itemWidth = _this.$box.find('li').outerWidth(true)
      var rowCount = Math.floor(_this.$box.width() / itemWidth)
      if (!_this.isToStart) {
        _this.isAnimate = true
        _this.$ul.animate({
          left: '+=' + rowCount * itemWidth
        }, 400, function() {
          _this.isToEnd = false
          _this.isAnimate = false
          if (parseFloat(_this.$ul.css('left')) >= 0) {
            _this.isToStart = true
          }
        })
      }
    })

    //选取专辑
    this.$footer.on('click', 'li', function() {
      $(this).addClass('active')
        .siblings().removeClass('active')

      //触发 select-albumn
      EventCenter.fire('select-albumn', {
        channelId: $(this).attr('data-channel-id'),
        channelName: $(this).attr('data-channel-name')
      })
    })
  },

  render: function() {
    var _this = this
    //获取专辑
    $.getJSON('//jirenguapi.applinzi.com/fm/getChannels.php')
      .done(function(ret) {
        _this.renderFooter(ret.channels)
      }).fail(function() {
        console.log('error')
      })
  },

  renderFooter: function(channels) {
    var html = ''
    //把本地 localStorage 的收藏也加上
    channels.unshift({
      channel_id: 0,
      name: '我的最爱',
      cover_small: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-small',
      cover_middle: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-middle',
      cover_big: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-big',
    })
    //构建DOM
    channels.forEach(function(channel) {
      html += '<li data-channel-id=' + channel.channel_id + ' data-channel-name=' + channel.name + '>' + '  <div class="cover" style="background-image:url(' + channel.cover_small + ')"></div>' + '  <h3>' + channel.name + '</h3>' + '</li>'
    })
    this.$ul.html(html)
    this.setStyle()
  },

  setStyle: function() {
    var count = this.$footer.find('li').length
    var width = this.$footer.find('li').outerWidth(true)
    //重置容器宽度
    this.$ul.css({
      width: count * width + 'px'
    })
  }
}


/*----------初始化 Fm--------*/
var Fm = {
  init: function() {
    this.channelId = 'public_shiguang_80hou'  //设置初始专辑
    this.channelName = '80后'
    this.$container = $('#page-music main')
    this.audio = new Audio()  //初始化 Audio
    this.audio.autoplay = true //自动播放
    this.currentSong = null  //当前音乐
    this.clock = null
    this.collections = this.loadFromLocal()  //本地收藏
    this.bind()

    this.playInit()  //播放初始化

  },

  playInit: function() {
    //本地收藏优先
    if (Object.keys(this.collections).length > 0) {
      EventCenter.fire('select-albumn', {
        channelId: '0',
        channelName: '我的最爱'
      })
    } else {
      //没有收藏就按初始专辑播放线上歌曲
      this.loadSong()
    }
  },
  bind: function() {
    var _this = this
    //响应 select-albumn
    EventCenter.on('select-albumn', function(e, channel) {
      _this.channelId = channel.channelId
      _this.channelName = channel.channelName
      _this.loadSong()
    })

    this.$container.find('.btn-play').on('click', function() {
      if ($(this).hasClass('icon-pause')) {
        $(this).removeClass('icon-pause').addClass('icon-play')
        _this.audio.pause()
      } else {
        $(this).removeClass('icon-play').addClass('icon-pause')
        _this.audio.play()
      }
    })

    this.$container.find('.btn-next').on('click', function() {
      _this.loadSong()
    })

    //非JQuery对象绑定事件
    this.audio.addEventListener('play', function() {
      clearInterval(_this.clock)
      _this.clock = setInterval(function() {
        _this.updateState()
        _this.setLyric()
      }, 1000)
    })

    this.audio.addEventListener('pause', function() {
      clearInterval(_this.clock)
    })
    this.audio.addEventListener('end', function() {
      _this.loadSong()
    })

    //增删我的收藏
    this.$container.find('.btn-collect').on('click', function() {
      var $btn = $(this)
      if ($btn.hasClass('active')) {
        $btn.removeClass('active')
          //直接删除对象中的元素
        delete _this.collections[_this.currentSong.sid]
      } else {
        $(this).addClass('active')
        _this.collections[_this.currentSong.sid] = _this.currentSong
      }
      //保存到  localStorage 里
      _this.saveToLocal()
    })



  },
  loadSong: function() {
    var _this = this
      //本地读取我的收藏
    if (this.channelId === '0') {
      _this.loadCollection()
    } else {
      //线上请求歌曲
      $.getJSON('//jirenguapi.applinzi.com/fm/getSong.php', {
          channel: this.channelId
        })
        .done(function(ret) {
          _this.play(ret.song[0] || null)
        })
    }
  },
  play: function(song) {
    this.currentSong = song  //重置当前歌曲
    this.audio.src = song.url
    this.$container.find('.btn-play').removeClass('icon-play').addClass('icon-pause')

    this.$container.find('.aside figure').css('background-image', 'url(' + song.picture + ')')
    $('.bg').css('background-image', 'url(' + song.picture + ')')
    this.$container.find('.detail h1').text(song.title)
    this.$container.find('.detail .author').text(song.artist)
    this.$container.find('.tag').text(this.channelName)

    //判断是否是本地收藏歌曲
    if (this.collections[song.sid]) {
      this.$container.find('.btn-collect').addClass('active')
    } else {
      this.$container.find('.btn-collect').removeClass('active')
    }

    this.loadLyric(song.sid)
  },
  //更新时间、进度条
  updateState: function() {
    var timeStr = Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60 / 100).toFixed(2).substr(2)
    this.$container.find('.current-time').text(timeStr)
    this.$container.find('.bar-progress').css('width', this.audio.currentTime / this.audio.duration * 100 + '%')
  },

  loadLyric: function(sid) {
    var _this = this
    $.getJSON('//jirenguapi.applinzi.com/fm/getLyric.php', {
        sid: sid
      })
      .done(function(ret) {
        var lyricObj = {}
        ret.lyric.split('\n').forEach(function(line) {
          var timeArr = line.match(/\d{2}:\d{2}/g)
          if (timeArr) {
            timeArr.forEach(function(time) {
              lyricObj[time] = line.replace(/\[.+?\]/g, '')
            })
          }
        })
        if(lyricObj['00:00'].indexOf('音乐来自') > -1){
          delete lyricObj['00:00']
        }
        _this.lyricObj = lyricObj
      })
  },
  setLyric: function() {
    var timeStr = '0' + Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60 / 100).toFixed(2).substr(2)
    if (this.lyricObj && this.lyricObj[timeStr]) {
      //可以添加更多的样式，用来显示歌词特效
      // var styles = ['slideInUp','zoomIn','rollIn', 'rotateIn', 'flipInX','fadeIn', 'bounceIn','swing', 'pulse']
      // var style = styles[Math.floor(Math.random()*styles.length)]
      this.$container.find('.lyric p').text(this.lyricObj[timeStr])
        .boomText()
    }
  },


  loadFromLocal: function() {
    return JSON.parse(localStorage['collections'] || '{}')
  },

  saveToLocal: function() {
    localStorage['collections'] = JSON.stringify(this.collections)
  },

  loadCollection: function() {
    var keyArray = Object.keys(this.collections)
    if (keyArray.length === 0) return
    var randomIndex = Math.floor(Math.random() * keyArray.length)
    var randomSid = keyArray[randomIndex]
    this.play(this.collections[randomSid])
  }

}

//设置 boomText 插件
$.fn.boomText = function(type) {
    //确认显示样式
    type = type || 'rollIn'
    //处理文本
    this.html(function() {
      var arr = $(this).text()
        .split('').map(function(word) {
          return '<span class="boomText">' + word + '</span>'
        })
      return arr.join('')
    })

    var index = 0
    var $boomTexts = $(this).find('span')
    var clock = setInterval(function() {
      $boomTexts.eq(index).addClass('animated ' + type)
      index++
      if (index >= $boomTexts.length) {
        clearInterval(clock)
      }
    }, 100)
  }



Footer.init()
Fm.init()