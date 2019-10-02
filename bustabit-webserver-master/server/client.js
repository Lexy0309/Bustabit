var assert = require('better-assert');
var async = require('async');
var bitcoinjs = require('bitcoinjs-lib');
var request = require('request');
var timeago = require('timeago');
var lib = require('./lib');
var database = require('./database');
var withdraw = require('./withdraw');
var sendEmail = require('./sendEmail');
var speakeasy = require('speakeasy');
var qr = require('qr-image');
var uuid = require('uuid');
var _ = require('lodash');
var config = require('../config/config');

var sessionOptions = {
    httpOnly: true,
    secure : config.PRODUCTION
};

exports.mcharge = function(req, res, next) {
	var user = req.user;
    assert(user);
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
	var str = lib.removeNullsAndTrim(req.query.str);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}

	var offset = Number((page-1)*limit);
    database.getMoneyHistory(user.id, limit, offset, function(err, moneys) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		database.getAccountInfo(function(err, result) {
			if (err) {
				return next(new Error('Unable to get deposits: \n' + err));
			}
			user.account = result;
			user.moneys = moneys;
			user.page = page;
			user.str = str;
			res.render('money-charge', { user:  user });
		});
    });
};
exports.mexchange = function(req, res, next) {
	var user = req.user;
    assert(user);
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
	var str = lib.removeNullsAndTrim(req.query.str);
    if (!Number.isFinite(page) || page < 0)
    page=1;

	var offset = Number((page-1)*limit);
    database.getMoneyExchangeHistory(user.id, limit, offset, function(err, moneys) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
       database.getExAccountInfo(user.id, function(err, result) {
			if (err) {
				return next(new Error('Unable to get deposits: \n' + err));
			}
			user.account = result;
			user.moneys = moneys;
			user.page = page;
			user.str = str;
			res.render('money-exchange', { user:  user });
		});
    });
};
exports.moneyRequest = function(req, res, next) {
    var user = req.user;
	var money = lib.removeNullsAndTrim(req.body.idTxtMoney);
	var bank = lib.removeNullsAndTrim(req.body.idBank);
	var owner = lib.removeNullsAndTrim(req.body.idOwner);
	var accountnum = lib.removeNullsAndTrim(req.body.idAccount);
	money = money.replace(/,/g, '');	
    assert(user);
    database.insertMoney(user.id, money, bank, owner, accountnum, function(err, results) {
        if (err) {
			if (err === 'NOT_CONDITION') {
				return res.redirect('/money-charge?str=notcondition');
			}
            return next(new Error('Unable to get money: \n' + err));
        }
        user.result = results;
        res.redirect('/money-charge');
    });
};
exports.exchangeRequest = function(req, res, next) {
    var user = req.user;
	var money = lib.removeNullsAndTrim(req.body.idTxtMoney);
	var bank = lib.removeNullsAndTrim(req.body.idBank);
	var owner = lib.removeNullsAndTrim(req.body.idOwner);
	var accountnum = lib.removeNullsAndTrim(req.body.idAccount);
	money = money.replace(/,/g, '');

    database.insertMoneyExchange(user.id, money, bank, owner, accountnum, function(err, results) {
		 if (err) {
            if (err === 'NOT_ENOUGTH') {
                return res.redirect('/money-exchange?str=notenough');
            }
			if (err === 'NOT_TIME') {
                return res.redirect('/money-exchange?str=nottime');
            }
			if (err === 'NOT_CONDITION') {
				return res.redirect('/money-exchange?str=notcondition');
			}
            return next(new Error('Unable to register user: \n' + err));
        }
        user.result = results;
        res.redirect('/money-exchange');
    });
};
exports.historyDelete = function(req, res, next) {
    var user = req.user;
	var dataIndex = req.body.dataIndex;
    assert(user);

	console.log('-------------------------'+dataIndex);

    database.historyDelete(dataIndex, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete: \n' + err));
        }
        res.redirect('/money-charge');
    });
};
exports.historyExchangeDelete = function(req, res, next) {
    var user = req.user;
	var dataIndex = req.body.dataIndex;
    assert(user);

	console.log('-------------------------'+dataIndex);

    database.historyExchangeDelete(dataIndex, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete: \n' + err));
        }
        res.redirect('/money-charge');
    });
};
exports.noticeList = function(req, res, next) {
	var user = req.user;
    var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
    if (!Number.isFinite(page) || page < 0)
    page=1;

	var offset = Number((page-1)*limit);
    database.getnoticeList(limit, offset, function(err, data) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		user.leaders = data;
		user.page = page;
        res.render('notice-list', { user:  user });
    });
};
exports.noticeRead = function(req, res, next) {
	var user = req.user;
    idx = parseInt(req.query.idx);
    if (!Number.isFinite(idx) || idx < 0)
		return next('User does not have page ', idx);

    database.getnoticeRead(idx, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
		var str1 = content.content;
		content.content = encodeURIComponent(str1);
		user.content = content;
        res.render('notice-read', { user:  user });
    });
};

exports.memoList = function(req, res, next) {
    var user = req.user;
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
    if (!Number.isFinite(page) || page < 0)
    page=1;

	var offset = Number((page-1)*limit);
    database.getmemoList(user.id, limit, offset, function(err, data) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		user.leaders = data;
		user.page = page;
        res.render('memo-list', { user:  user });
    });
};
exports.memoRead = function(req, res, next) {
	var user = req.user;
    idx = parseInt(req.query.idx);
    if (!Number.isFinite(idx) || idx < 0)
		return next('User does not have page ', idx);

    database.getmemoRead(idx, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
		var str1 = content.content;
		content.content = encodeURIComponent(str1);
		user.content = content;
        res.render('memo-read', { user:  user });
    });
};
exports.memoNext = function(req, res, next) {
	var user = req.user;
    idx = parseInt(req.query.idx);
    if (!Number.isFinite(idx) || idx < 0)
		return next('User does not have page ', idx);

    database.getmemoNext(idx, user.id, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
		var str1 = content.content;
		content.content = encodeURIComponent(str1);

		user.content = content;
        res.render('memo-read', { user:  user });
    });
};
exports.memoPrev = function(req, res, next) {
	var user = req.user;
    idx = parseInt(req.query.idx);
    if (!Number.isFinite(idx) || idx < 0)
		return next('User does not have page ', idx);
	
    database.getmemoPrev(idx, user.id, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
		var str1 = content.content;
		content.content = encodeURIComponent(str1);

        user.content = content;
        res.render('memo-read', { user:  user });
    });
};
exports.memoDelete = function(req, res, next) {

    var dataIndex = req.query.idx;
    database.memoDelete(dataIndex, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete: \n' + err));
        }
        res.redirect('/memo-list');
    });
};
exports.qnaList = function(req, res, next) {
    var user = req.user;
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
    if (!Number.isFinite(page) || page < 0)
    page=1;

	var offset = Number((page-1)*limit);
    database.getqnaList(user.id, limit, offset, function(err, data) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		user.leaders = data;
		user.page = page;
        res.render('qna-list', { user:  user });
    });
};
exports.qnaRead = function(req, res, next) {
	var user = req.user;
	var update_flag = 'false';
    idx = parseInt(req.query.idx);
	var rno = parseInt(req.query.rno);
    if (!Number.isFinite(idx) || idx < 0)
		return next('User does not have page ', idx);

    database.getqnaRead(idx, rno, update_flag, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
		var str1 = content.inquiry_contents;
		content.inquiry_contents = encodeURIComponent(str1);
		var str2 = content.reply_contents;
		content.reply_contents = encodeURIComponent(str2);

		user.content = content;
        res.render('qna-read', { user:  user });
    });
};
exports.qnaInsert = function(req, res, next) {
	var user = req.user;
    subject = req.query.title;
	content = req.query.text;
    database.qnaInsert(user.id, subject, content, function(err, content) {
        if (err) {
            return next(new Error('Unable to get content: \n' + err));
        }
        res.redirect('/qna-list');
    });
};
exports.qnaDelete = function(req, res, next) {
	var user = req.user;
    var dataIndex = req.query.idx;
    database.qnaDelete(dataIndex, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete: \n' + err));
        }
        res.redirect('/qna-list');
    });
};
exports.moneychargelist = function(req, res, next) {
	var user = req.user;
    var limit = 10;
	var page = parseInt(req.body.page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}

	var offset = Number((page-1)*limit);
     database.getMoneyHistory(user.id, limit, offset, function(err, moneys) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		user.moneys = moneys;
		database.getRequestState(user.id, function(err, results) {
			if(err) {
				return next(new Error('Unable to get deposits: \n' + err));
			}
			if(results.cnt == 0) user.state = 'no';
			else user.state = 'yes';
 			res.render('money-charge-result', { user:  user });
		});
    });
};
exports.moneyexchangelist = function(req, res, next) {
	var user = req.user;
    var limit = 10;
	var page = parseInt(req.body.page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
     database.getMoneyExchangeHistory(user.id, limit, offset, function(err, moneys) {
        if (err) {
            return next(new Error('Unable to get deposits: \n' + err));
        }
		user.moneys = moneys;
		database.getRequestState1(user.id, function(err, results) {
			if(err) {
				return next(new Error('Unable to get deposits: \n' + err));
			}
			if(results.cnt == 0) user.state = 'no';
			else user.state = 'yes';
 			res.render('money-exchange-result', { user:  user });
		});
		
    });
};
exports.refresh = function(req, res, next) {
	var user = req.user;
	user.balance_satoshis = lib.formatSatoshis(user.balance_satoshis, 0);
	user.point = lib.formatSatoshis(user.point, 0);
	res.render('template/header_new1', {user: user});
};
exports.changePoint = function(req, res, next) {
	var user = req.user;
	var uid = lib.removeNullsAndTrim(req.body.uid);
	database.changePoint(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete: \n' + err));
        }
		user.balance_satoshis = lib.formatSatoshis(results.balance_satoshis, 0);
		user.point = lib.formatSatoshis(results.point, 0);
		res.render('template/header_new1', {user: user});
    });
};