
var express = require('express'),
  request = require('request'),
  should = require('should'),
  qs = require('qs')
var Grant = require('../').express(),
  oauth1 = require('../lib/oauth1')


describe('oauth1', function () {
  function url (path) {
    var c = config.server
    return c.protocol + '://' + c.host + path
  }

  var grant, app, server
  var config = {server: {protocol:'http', host:'localhost:5000', callback:'/'}}

  describe('success', function () {
    before(function (done) {
      grant = new Grant(config)
      app = express().use(grant)

      grant.config.twitter.request_url = url('/request_url')
      grant.config.twitter.authorize_url = '/authorize_url'
      grant.config.twitter.access_url = url('/access_url')

      app.post('/request_url', function (req, res) {
        res.end(qs.stringify({some:'data'}))
      })
      app.post('/access_url', function (req, res) {
        res.end(JSON.stringify({some:'data'}))
      })
      server = app.listen(5000, done)
    })

    it('step1', function (done) {
      oauth1.step1(grant.config.twitter, function (err, data) {
        should.deepEqual(data, {some:'data'})
        done()
      })
    })

    it('step2', function () {
      var url = oauth1.step2(grant.config.twitter, {oauth_token:'token'})
      url.should.equal('/authorize_url?oauth_token=token')
    })

    it('step3', function (done) {
      oauth1.step3(grant.config.twitter, {}, {oauth_token:'token'}, function (err, url) {
        url.should.equal('/?raw%5Bsome%5D=data')
        done()
      })
    })

    after(function (done) {
      server.close(done)
    })
  })

  describe('error', function () {
    before(function (done) {
      grant = new Grant(config)
      app = express().use(grant)

      grant.config.twitter.request_url = url('/request_err')
      grant.config.twitter.authorize_url = '/authorize_url'
      grant.config.twitter.access_url = url('/access_url')

      app.post('/request_url', function (req, res) {
        res.status(500).end(JSON.stringify({error:'invalid'}))
      })

      server = app.listen(5000, done)
    })

    it('step1 - network error', function (done) {
      oauth1.step1(grant.config.twitter, function (err, body) {
        err.should.equal('error%5BCannot%20POST%20%2Frequest_err%0A%5D=')
        should.deepEqual(qs.parse(err), {error: {'Cannot POST /request_err\n': ''}})
        done()
      })
    })
    it('step1 - error response', function (done) {
      grant.config.twitter.request_url = url('/request_url')
      oauth1.step1(grant.config.twitter, function (err, body) {
        err.should.equal('error%5Berror%5D=invalid')
        should.deepEqual(qs.parse(err), {error: {error:'invalid'}})
        done()
      })
    })

    it('step2 - mising oauth_token - error response', function () {
      var url = oauth1.step2(grant.config.twitter, {error:'invalid'})
      url.should.equal('/?error%5Berror%5D=invalid')
    })
    it('step2 - mising oauth_token - empty response', function () {
      var url = oauth1.step2(grant.config.twitter, {})
      url.should.equal('/?error%5Berror%5D=Grant%3A%20request_url')
    })

    it('step3 - mising oauth_token - response error', function (done) {
      oauth1.step3(grant.config.twitter, {}, {error:'invalid'}, function (err, body) {
        err.should.equal('error%5Berror%5D=invalid')
        should.deepEqual(qs.parse(err), {error: {error:'invalid'}})
        done()
      })
    })
    it('step3 - mising oauth_token - empty response', function (done) {
      oauth1.step3(grant.config.twitter, {}, {}, function (err, body) {
        err.should.equal('error%5Berror%5D=Grant%3A%20authorize_url')
        should.deepEqual(qs.parse(err), {error: {error:'Grant: authorize_url'}})
        done()
      })
    })

    after(function (done) {
      server.close(done)
    })
  })

  describe('custom', function () {
    describe('step2', function () {
      before(function () {
        grant = new Grant(config)
      })

      describe('custom_parameters', function () {
        it('flickr', function () {
          grant.config.flickr.scope = ['read','write']
          var url = oauth1.step2(grant.config.flickr, {oauth_token:'token'})
          var query = qs.parse(url.split('?')[1])
          should.deepEqual(query,
            {oauth_token:'token', perms:['read','write']})
        })

        it('trello', function () {
          grant.config.trello.scope = ['read','write']
          grant.config.trello.expiration = 'never'
          var url = oauth1.step2(grant.config.trello, {oauth_token:'token'})
          var query = qs.parse(url.split('?')[1])
          should.deepEqual(query,
            {oauth_token:'token', scope:['read','write'], expiration:'never'})
        })
      })

      it('tripit', function () {
        var _url = oauth1.step2(grant.config.tripit, {oauth_token:'token'})
        var query = qs.parse(_url.split('?')[1])
        should.deepEqual(query,
          {oauth_token:'token', oauth_callback:url('/connect/tripit/callback')})
      })
    })
  })
})
