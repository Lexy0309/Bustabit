var admin = require('./admin');
var assert = require('better-assert');
var lib = require('./lib');
var database = require('./database');
var user = require('./user');
var client = require('./client');
var games = require('./games');
var sendEmail = require('./sendEmail');
var stats = require('./stats');
var config = require('../config/config');
var recaptchaValidator = require('recaptcha-validator');


var production = process.env.NODE_ENV === 'production';

function staticPageLogged(page, loggedGoTo) {

    return function(req, res) {
        var user = req.user;
        if (!user){
            return res.render(page);
        }
        if (loggedGoTo) return res.redirect(loggedGoTo);

        res.render(page, {
            user: user
        });
    }
}
 
function contact(origin) {
    assert(typeof origin == 'string');

    return function(req, res, next) {
        var user = req.user;
        var from = req.body.email;
        var message = req.body.message;

        if (!from ) return res.render(origin, { user: user, warning: 'email required' });

        if (!message) return res.render(origin, { user: user, warning: 'message required' });

        if (user) message = 'user_id: ' + req.user.id + '\n' + message;

        sendEmail.contact(from, message, null, function(err) {
            if (err)
                return next(new Error('Error sending email: \n' + err ));

            return res.render(origin, { user: user, success: 'Thank you for writing, one of my humans will write you back very soon :) ' });
        });
    }
}

function restrict(req, res, next) {
	//console.log('restrict =', req.user);
    if (!req.user) {
		//console.log('!req.user');
       res.status(401);
       if (req.header('Accept') === 'text/plain')
          res.send('Not authorized');
       else
          res.render('401');
       return;
    } else
        next();
}

function restrictRedirectToHome(req, res, next) {
    if(!req.user) {
        res.redirect('/');
        return;
    }
    next();
}

function adminRestrict(req, res, next) {


    if (!req.user || req.user.userclass == 'user') {
        res.status(401);
        if (req.header('Accept') === 'text/plain')
            res.send('Not authorized');
        else
            res.render('401'); //Not authorized page.
        return;
    }
    next();
}

function recaptchaRestrict(req, res, next) {
  /*var recaptcha = lib.removeNullsAndTrim(req.body['g-recaptcha-response']);
  if (!recaptcha) {
    return res.send('No recaptcha submitted, go back and try again');
  }

  recaptchaValidator.callback(config.RECAPTCHA_PRIV_KEY, recaptcha, req.ip, function(err) {
    if (err) {
      if (typeof err === 'string')
        res.send('Got recaptcha error: ' + err + ' please go back and try again');
      else {
        console.error('[INTERNAL_ERROR] Recaptcha failure: ', err);
        res.render('error');
      }
      return;
    }

    next();
  });*/
  console.log('recap');
  next();
}


function table() {
    return function(req, res) {
        res.render('table_old', {
            user: req.user,
            table: true
        });
    }
}

function tableNew() {
    return function(req, res) {
        res.render('table_new', {
            user: req.user,
            buildConfig: config.BUILD,
            table: true
        });
    }
}
function admin_() {
	console.log('admin_');
    return function(req, res) {
		if (!req.user || !req.user.admin) {
			res.status(401);
			if (req.header('Accept') === 'text/plain')
				res.send('Not authorized');
			else
				res.render('401'); //Not authorized page.
			return;
		}
        res.render('admin', {
            user: req.user,
            buildConfig: config.BUILD,
            table: true
        });
    }
}

function tableDev() {
    return function(req, res) {
        if(config.PRODUCTION)
            return res.status(401);
        requestDevOtt(req.params.id, function(devOtt) {
            res.render('table_new', {
                user: req.user,
                devOtt: devOtt,
                table: true
            });
        });
    }
}
function requestDevOtt(id, callback) {
    var curl = require('curlrequest');
    var options = {
        url: 'https://www.bustabit.com/ott',
        include: true ,
        method: 'POST',
        'cookie': 'id='+id
    };

    var ott=null;
    curl.request(options, function (err, parts) {
        parts = parts.split('\r\n');
        var data = parts.pop()
            , head = parts.pop();
        ott = data.trim();
        console.log('DEV OTT: ', ott);
        callback(ott);
    });
}

module.exports = function(app) {

	//app.get('/', tableNew());
    app.get('/', staticPageLogged('index'));
    app.get('/register', staticPageLogged('register', '/play'));
    app.get('/login', staticPageLogged('login', '/play'));
	app.get('/logout', restrictRedirectToHome, user.logout);

    app.get('/reset/:recoverId', user.validateResetPassword);
    app.get('/faq', staticPageLogged('faq'));
	//add by lt
	app.get('/money-charge', restrict, client.mcharge);
	app.get('/money-exchange', restrict, client.mexchange);
	app.get('/notice-list', restrict, client.noticeList);
	app.get('/notice-read', restrict, client.noticeRead);
	app.get('/memo-list', restrict, client.memoList);
	app.get('/memo-read', restrict, client.memoRead);
	app.get('/memo-next', restrict, client.memoNext);
	app.get('/memo-prev', restrict, client.memoPrev);
	app.get('/memo-delete', restrict, client.memoDelete);
	app.get('/qna-list', restrict, client.qnaList);
	app.get('/qna-read', restrict, client.qnaRead);
	app.get('/qna-write', staticPageLogged('qna-write'));
	app.get('/qna-insert', restrict, client.qnaInsert);
	app.get('/qna-delete', restrict, client.qnaDelete);

	app.get('/admin-money-charge', adminRestrict, admin.moneyCharge);
	app.get('/admin-money-exchange', adminRestrict, admin.moneyExchange);
	app.get('/admin-notice', adminRestrict, admin.noticeList);
	app.get('/admin-notice-insert', adminRestrict, admin.noticeInsert);
	app.get('/admin-notice-delete', adminRestrict, admin.noticeDelete);
	app.get('/admin-memo', adminRestrict, admin.memoList);
	app.get('/admin-qna', adminRestrict, admin.qnaList);
	app.get('/admin-virUser', adminRestrict, admin.vUserList);
	app.get('/admin-vUser-insert', adminRestrict, admin.vUserInsert);
	app.get('/admin-vUser-delete', adminRestrict, admin.vUserDelete);
	app.get('/admin-user', adminRestrict, admin.userList);
	app.get('/admin-con-user', adminRestrict, admin.conUserList);
	app.get('/viewInOutput', adminRestrict, admin.viewInOutput);
	app.get('/admin-user-logout', adminRestrict, admin.userLogout);
	app.get('/admin-partner', adminRestrict, admin.partnerList);
	app.get('/partner-register', adminRestrict, admin.partnerRegister);
	app.get('/partner-delete', adminRestrict, admin.partnerDelete);
	app.get('/modify_partner', adminRestrict, admin.partnerModify);
	app.get('/admin-todaymoney', adminRestrict, admin.todayMoney);
	app.get('/admin-todayViewDetail', adminRestrict, admin.tmViewDetail);
	
	app.get('/admin-badip', adminRestrict, admin.badip);
	app.get('/admin-account', adminRestrict, admin.account);
	app.get('/admin-badipDelete', adminRestrict, admin.badipDelete);

	app.get('/admin-maxprofit', adminRestrict, admin.maxprofit);

	app.get('/add_badip', adminRestrict, admin.addbadip);
	app.get('/admin-account-insert', adminRestrict, admin.insertAccount);
	app.get('/admin-deleteAccount', adminRestrict, admin.deleteAccount);
	app.get('/admin-selectAccount', adminRestrict, admin.selectAccount);
	app.get('/admin-codeByList', adminRestrict, admin.codeByList);
	app.get('/moneyIn-delete', adminRestrict, admin.moneyInDelete);
	app.get('/moneyOut-delete', adminRestrict, admin.moneyOutDelete);
	app.get('/admin-logout', adminRestrict, admin.forceout);
	app.get('/admin-cancelout', adminRestrict, admin.cancelout);
	app.get('/admin-viewPartner', adminRestrict, admin.viewPartner);
    app.get('/admin-viewPartner1', adminRestrict, admin.viewPartner1);
	
	app.get('/user_modify_balance', adminRestrict, admin.onlymodifyval);
	app.get('/con_modify_balance', adminRestrict, admin.conmodifyval);
	app.get('/viewByuserIO', adminRestrict, admin.viewByuserIO);
	app.get('/admin-balance-account', adminRestrict, admin.balanceAccount);
	app.get('/admin-gamelog', adminRestrict, admin.updateGameLog);	




    app.get('/contact', staticPageLogged('contact'));
    app.get('/request', restrict, user.request);
    app.get('/deposit', restrict, user.deposit);
    app.get('/withdraw', restrict, user.withdraw);
    app.get('/withdraw/request', restrict, user.withdrawRequest);
    app.get('/support', restrict, user.contact);
    app.get('/account', restrict, user.account);
    app.get('/security', restrict, user.security);
    app.get('/forgot-password', staticPageLogged('forgot-password'));
    app.get('/calculator', staticPageLogged('calculator'));
    app.get('/guide', staticPageLogged('guide'));


	app.get('/adminlogin', staticPageLogged('adminlogin'));
	app.get('/admin', admin_());

    app.get('/play-old', table());
    app.get('/play', tableNew());
    app.get('/play-id/:id', tableDev());

    app.get('/leaderboard', games.getLeaderBoard);
    app.get('/game/:id', games.show);
    app.get('/user/:name', user.profile);

    app.get('/error', function(req, res, next) { // Sometimes we redirect people to /error
      return res.render('error');
    });

    app.post('/request', restrict, recaptchaRestrict, user.giveawayRequest);
    app.post('/sent-reset', user.resetPasswordRecovery);
    app.post('/sent-recover', recaptchaRestrict, user.sendPasswordRecover);
    app.post('/reset-password', restrict, user.resetPassword);
    app.post('/edit-email', restrict, user.editEmail);
    app.post('/enable-2fa', restrict, user.enableMfa);
    app.post('/disable-2fa', restrict, user.disableMfa);
    app.post('/withdraw-request', restrict, user.handleWithdrawRequest);
    app.post('/support', restrict, contact('support'));
    app.post('/contact', contact('contact'));
	
    app.post('/logout', restrictRedirectToHome, user.logout);
    app.post('/login', recaptchaRestrict, user.login);
    app.post('/register', recaptchaRestrict, user.register);
	app.post('/refresh', restrict, client.refresh);
	
	app.post('/change_point', restrict, client.changePoint);


	//add by lt
	app.post('/request-money-charge', restrict, client.moneyRequest);
	app.post('/delete-money-history', restrict, client.historyDelete);

	app.post('/request-money-exchange', restrict, client.exchangeRequest);
	app.post('/delete-exchange-history', restrict, client.historyExchangeDelete);
	app.post('/money-charge-list', restrict, client.moneychargelist);
	app.post('/money-exchange-list', restrict, client.moneyexchangelist);


	//app.post('/search-money-charge', adminRestrict, admin.searchCharge);
	app.post('/money-charge-approval', adminRestrict, admin.approvalCharge);
	app.post('/money-charge-defer', adminRestrict, admin.deferCharge);
	app.post('/money-charge-refuse', adminRestrict, admin.refuseCharge);
	//admin
	//app.post('/search-money-exchange', adminRestrict, admin.searchExchange);
	app.post('/money-exchange-approval', adminRestrict, admin.approvalExchange);
	app.post('/money-exchange-defer', adminRestrict, admin.deferExchange);
	app.post('/money-exchange-refuse', adminRestrict, admin.refuseExchange);
	
	app.post('/get_notice_info', adminRestrict, admin.getNoticeInfo);
	
	app.post('/search-qna-list', adminRestrict, admin.searchQna);
	app.post('/reply-result', adminRestrict, admin.replyResult);
	app.get('/reply-insert', adminRestrict, admin.replyInsert);
	app.post('/qna-delete', adminRestrict, admin.qnaDelete);

	app.post('/search-memo-list', adminRestrict, admin.searchMemo);
	app.post('/memo-delete', adminRestrict, admin.memoDelete);
	app.post('/get_memo_info', adminRestrict, admin.getMemoInfo);
	app.get('/admin-memo-insert', adminRestrict, admin.memoInsert);
	
	app.post('/cancel-bet-vUser', adminRestrict, admin.betCancel);
	app.post('/cancel-chat-user', adminRestrict, admin.chatCancel);
	//app.post('/admin_viruser_search', adminRestrict, admin.vUserSearchByName);
	app.post('/update_balance', adminRestrict, admin.updateBalance);
	app.post('/update_betsize', adminRestrict, admin.updateBetsize);
	app.post('/update_betval', adminRestrict, admin.updateBetval);
	//app.post('/update_gamelog', adminRestrict, admin.updateGameLog);
	app.post('/update_stopped', adminRestrict, admin.updatestopped);
	app.post('/update_bettingsize', adminRestrict, admin.updatebettingsize);

	//app.post('/search-admin-user', adminRestrict, admin.searchAdminUser);
	app.post('/modify_user_info', adminRestrict, admin.modifyUserInfo);
	app.post('/modify_con_info', adminRestrict, admin.modifyConInfo);
	
	app.post('/get_user_info', adminRestrict, admin.getUserInfo);
	app.post('/today-settlement', adminRestrict, admin.todaySettlement);
	//app.post('/search-admin-con', adminRestrict, admin.searchAdminCon);
	app.post('/partner_register', adminRestrict, admin.ptRegister);
	//app.post('/partner_search', adminRestrict, admin.ptSearch);
	app.post('/request_partner_auth', admin.partnercodeAuth);
	app.post('/request_username_auth', admin.usernameAuth);
	app.post('/date_search', adminRestrict, admin.dateSearch);
	app.post('/moneyinfo_format', adminRestrict, admin.infoFormat);
	app.post('/search-todaymoney-list', adminRestrict, admin.todaymoneyByUser);
	app.post('/set_play', adminRestrict, admin.setPlay);
	app.post('/user_datail', adminRestrict, admin.userDetail);
	app.post('/admin-modify-max', adminRestrict, admin.modifymax);
	app.post('/admin-account-modify', adminRestrict, admin.modifyAccount);
	
	//app.post('/search_balance_account', adminRestrict, admin.searchBalAccount);
	app.post('/admin_register_bonus', adminRestrict, admin.registerBonus);
	app.post('/admin_register_exchange', adminRestrict, admin.registerExchange);
	
  app.post('/refreshTodayMoney', restrict, admin.refreshTodayMoney);
	



	app.post('/adminlogin', recaptchaRestrict, user.adminlogin);

    app.post('/ott', restrict, function(req, res, next) {
		console.log('------------------/ott');
        var user = req.user;
        var ipAddress = req.ip;
		
        var userAgent = req.get('user-agent');
		//add by lt
		var str = req.get('host');
		str = str.split(":");
		var addDomain = str[0];
		var ip1 = ipAddress.split(":");
		ipAddress = ip1[ip1.length-1];

        assert(user);
        database.createOneTimeToken(user.id, ipAddress, userAgent, function(err, token) {
            if (err) {
                console.error('[INTERNAL_ERROR] unable to get OTT got ' + err);
                res.status(500);
                return res.send('Server internal error');
            }
            res.send(token);
        });
    });
    app.get('/stats', stats.index);


    // Admin stuff
    app.get('/admin-giveaway', adminRestrict, admin.giveAway);
    app.post('/admin-giveaway', adminRestrict, admin.giveAwayHandle);

    app.get('*', function(req, res) {
        res.status(404);
        res.render('404');
    });
};