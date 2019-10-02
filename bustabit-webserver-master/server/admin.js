var assert = require('assert');
var async = require('async');
var database = require('./database');
var config = require('../config/config');
var lib = require('./lib');

/**
 * The req.user.admin is inserted in the user validation middleware
 */

exports.giveAway = function(req, res) {
    var user = req.user;
    assert(user.admin);
    res.render('giveaway', { user: user });
};

exports.giveAwayHandle = function(req, res, next) {
    var user = req.user;
    assert(user.admin);

    if (config.PRODUCTION) {
        var ref = req.get('Referer');
        if (!ref) return next(new Error('Possible xsfr')); //Interesting enough to log it as an error

        if (ref.lastIndexOf('https://www.bustabit.com/admin-giveaway', 0) !== 0)
            return next(new Error('Bad referrer got: ' + ref));
    }

    var giveAwayUsers = req.body.users.split(/\s+/);
    var bits = parseFloat(req.body.bits);

    if (!Number.isFinite(bits) || bits <= 0)
        return next('Problem with bits...');

    var satoshis = Math.round(bits * 100);

    database.addRawGiveaway(giveAwayUsers, satoshis , function(err) {
        if (err) return res.redirect('/admin-giveaway?err=' + err);

        res.redirect('/admin-giveaway?m=Done');
    });
};
//Charge
/*
exports.moneyCharge = function(req, res, next) {
    var user = req.user;
	var button = req.query.button;
	if(button) {
		assert(button);
		user.button = button;
		res.render('admin-money-charge', { user: user });
	}
	else {
		res.render('admin-money-charge', { user: user });
	}
};*/
exports.moneyCharge = function(req, res, next) {
    var user = req.user;
	var username = lib.removeNullsAndTrim(req.query.username);
	var pay_state = lib.removeNullsAndTrim(req.query.pay_state);
	var page = lib.removeNullsAndTrim(req.query.page);
	var limit = 10;
	//var page = null;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
    database.getSearchCharge(user.id, user.userclass, user.solecodeinput, username, pay_state,  limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
		if(!pay_state) pay_state = '';
		if(!username)  username = '';
		user.pay_state = pay_state;
		user.searchname = username;
		res.render('admin-money-charge', {user: user});	
	});
};
exports.approvalCharge = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;
    assert(user);

    database.approvalCharge(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to approval: \n' + err));
        }
		res.render('admin-money-charge', {user: user});
    });
};
exports.deferCharge = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;
    assert(user);

    database.deferCharge(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to defer: \n' + err));
        }
		res.render('admin-money-charge', {user: user});
    });
};
exports.refuseCharge = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;
    assert(user);

    database.refuseCharge(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to refuse: \n' + err));
        }
		res.render('admin-money-charge', {user: user});
    });
};

//Exchange
/*
exports.moneyExchange = function(req, res, next) {
    var user = req.user;
	var button = req.query.button;
	
	if(button) {
		assert(button);
		user.button = button;
		res.render('admin-money-exchange', { user: user });
	}
	else {
		res.render('admin-money-exchange', { user: user });
	}
};*/
exports.moneyExchange = function(req, res, next) {
    var user = req.user;
	var user = req.user;
	var username = lib.removeNullsAndTrim(req.query.username);
	var pay_state = lib.removeNullsAndTrim(req.query.pay_state);
	var page = lib.removeNullsAndTrim(req.query.page);
	var limit = 10;
	//var page = null;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
    database.getSearchExchange(user.id, user.userclass, user.solecodeinput, username, pay_state, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
		if(!pay_state) pay_state = '';
		if(!username)  username = '';
		user.pay_state = pay_state;
		user.searchname = username;
        res.render('admin-money-exchange', {user: user});
    });
};
exports.approvalExchange = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;

    assert(user);

    database.approvalExchange(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to approval: \n' + err));
        }
		res.render('admin-money-exchange', {user: user});
    });
};
exports.deferExchange = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;
    assert(user);

    database.deferExchange(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to defer: \n' + err));
        }
		res.render('admin-money-exchange', {user: user});
    });
};
exports.refuseExchange = function(req, res, next) {
    var user = req.user;
	var moneyId = req.body.moneyId;
    assert(user);

    database.refuseExchange(moneyId, function(err, results) {
        if (err) {
            return next(new Error('Unable to refuse: \n' + err));
        }
		res.render('admin-money-exchange', {user: user});
    });
};
exports.noticeList = function(req, res, next) {
	var user = req.user;
    assert(user);
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}

	var offset = Number((page-1)*limit);
    database.getnoticeList(limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get notices: \n' + err));
        }
        user.results = results;
		user.page = page;
        res.render('admin-notice', { user:  user });
    });
};
exports.noticeInsert = function(req, res, next) {
	var user = req.user;
    subject = req.query.title;
	content = req.query.text;
	state = req.query.state;
	uId = req.query.uId;
	database.adminNoticeInsert(uId, subject, content, state, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-notice');
	});

};
exports.getNoticeInfo = function(req, res, next) {
    var user = req.user;
	var notice_uid = req.body.notice_uid;
    assert(user);

    database.getNoticeInfo(notice_uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to refuse: \n' + err));
        }
		var str1 = results.content;
		results.content = encodeURIComponent(str1);
		user.notice = results;
		res.render('admin-notice-info', {user: user});
    });
};
exports.noticeDelete = function(req, res, next) {
	var user = req.user;
    uId = req.query.uId;

	database.adminNoticeDelete(uId, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-notice');
	});
};
exports.memoList = function(req, res, next) {
	var user = req.user;
	/*database.getuserList(function(err, results) {
        if (err) {
            return next(new Error('Unable to get notices: \n' + err));
        }
        user.results = results;
       
    });
	*/
	 res.render('admin-memo', { user:  user });

};

//qna
exports.qnaList = function(req, res, next) {
    var user = req.user;
	var username = req.query.username;
	/*
	database.getuserList(function(err, results) {
        if (err) {
            return next(new Error('Unable to get notices: \n' + err));
        }
        user.results = results;
        res.render('admin-qna', { user:  user });
    });
	*/
	 user.param = username;
	 res.render('admin-qna', { user:  user });
};
exports.searchQna = function(req, res, next) {
    var user = req.user;
	var username = lib.removeNullsAndTrim(req.body.username);
	var page = lib.removeNullsAndTrim(req.body.page);
	var limit = 10;
	//var page = null;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
    database.getSearchQna(username, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
        res.render('admin-qna-result', {user: user});
    });
};
exports.replyResult = function(req, res, next) {
    var user = req.user;
	var inquiry_no = req.body.inquiry_no;
	var update_flag = 'true';
    assert(user);
	var rno = '';
    database.getqnaRead(inquiry_no, rno, update_flag, function(err, results) {
        if (err) {
            return next(new Error('Unable to approval: \n' + err));
        }
		var str1 = results.inquiry_contents;
		results.content = encodeURIComponent(str1);
		var str2 = results.reply_contents;
		results.content = encodeURIComponent(str2);
		user.reply = results;
		res.render('admin-reply-result', {user: user});
    });
};
exports.replyInsert = function(req, res, next) {
    var user = req.user;
	var inquiry_no = lib.removeNullsAndTrim(req.query.inquiry_no);
	var reply_no = lib.removeNullsAndTrim(req.query.reply_no);
	reply_no = parseInt(reply_no);
	if (!Number.isFinite(reply_no) || reply_no < 0){
		reply_no = 0;	
	}
	var reply_subject = lib.removeNullsAndTrim(req.query.title);
	var reply_content = lib.removeNullsAndTrim(req.query.text);
	database.insertReply(inquiry_no, reply_no, reply_subject, reply_content, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
        res.redirect('/admin-qna');
    });
};
exports.qnaDelete = function(req, res, next) {
    var user = req.user;
	var inquiry_no = lib.removeNullsAndTrim(req.body.uNo);

	database.qnaDelete(inquiry_no, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete qna: \n' + err));
        }
        res.redirect('admin-qna');
    });
};

//Memo
exports.searchMemo = function(req, res, next) {
    var user = req.user;
	var username = lib.removeNullsAndTrim(req.body.username1);
	var page = lib.removeNullsAndTrim(req.body.page);
	var limit = 10;
	//var page = null;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
    database.getSearchMemo(username, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
        res.render('admin-memo-result', {user: user});
    });
};
exports.memoDelete = function(req, res, next) {
    var user = req.user;
	var uId = lib.removeNullsAndTrim(req.body.uId);

	database.memoDelete(uId, function(err, results) {
        if (err) {
            return next(new Error('Unable to delete qna: \n' + err));
        }
        res.redirect('/admin-memo');
    });
};
exports.memoInsert = function(req, res, next) {

	var user = req.user;
    subject = lib.removeNullsAndTrim(req.query.title);
	content = lib.removeNullsAndTrim(req.query.text);
	state = lib.removeNullsAndTrim(req.query.state);
	uId = lib.removeNullsAndTrim(req.query.uId);
	username = lib.removeNullsAndTrim(req.query.username);
    // Added by jjb 2017.10.23.
    toAll = lib.removeNullsAndTrim(req.query.toAll);
    if(toAll == 1)
    {
        database.adminMemoInsertAll(subject, content, state, function(err, result) {
            if (err) {
                return next(new Error('Unable to insert all: \n' + err));
            }
            res.redirect('/admin-memo');
        }); 
    } // End
    else
    {
        database.getUserIdFromUsername(username, function(err, result) {
            if (err) {
                return next(new Error('Unable to get content: \n' + err));
            }
            user_id =  result.id;
            database.adminMemoInsert(uId, subject, content, state, user_id, function(err, content) {
                if (err) {
                    return next(new Error('Unable to get content: \n' + err));
                }
                res.redirect('/admin-memo');
            });
        });
    }
};
exports.getMemoInfo = function(req, res, next) {
    var user = req.user;
	var uid = req.body.uid;
    assert(user);

    database.getMemoInfo(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to refuse: \n' + err));
        }
		var str1 = results.content;
		results.content = encodeURIComponent(str1);
		user.memo = results;
		
		res.render('admin-memo-info', {user: user});
    });
}
/*
exports.qnaList = function(req, res, next) {
    var user = req.user;
	database.getuserList(function(err, results) {
        if (err) {
            return next(new Error('Unable to get notices: \n' + err));
        }
        user.results = results;
        res.render('admin-qna', { user:  user });
    });
};
*/
exports.vUserList = function(req, res, next) {
	var user = req.user;
    assert(user);
	var limit = 10;
	var page = null;
    page = parseInt(req.query.page);
	var uid = lib.removeNullsAndTrim(req.query.uid);
	var username = lib.removeNullsAndTrim(req.query.username);
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
	database.getvUserList(username, limit, offset, function(err, results) {
		if (err) {
			return next(new Error('Unable to get notices: \n' + err));
		}
		user.results = results;
		user.page = page;
		if(!username) username = 'maxline';
		user.searchname = username;
		res.render('admin-virUser', { user:  user });
	});
};
/*
exports.vUserSearchByName = function(req, res, next) {
	var user = req.user;
    assert(user);
	var limit = 10;
	var page = null;
    page = parseInt(req.body.page);
	username = req.body.username;
    if (!Number.isFinite(page) || page < 0){
		page = 1;	
	}
	var offset = Number((page-1)*limit);
    database.vUserSearchByName(username, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get notices: \n' + err));
        }
        user.results = results;
		user.page = page;
		res.render('admin-virUser-search-result', { user:  user });
    });
};*/
exports.vUserInsert = function(req, res, next) {
	var user = req.user;
    username = req.query.username;
	password = req.query.password;
	balance_satoshis = req.query.balance_satoshis;
	phone = req.query.phone;
	

	database.adminvUserInsert(username, password, balance_satoshis, phone, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});

};
exports.vUserDelete = function(req, res, next) {
	var user = req.user;
    uId = req.query.uId;
	

	database.adminvUserDelete(uId, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};
exports.betCancel = function(req, res, next) {
    var user = req.user;
	var dataIndex = req.body.dataIndex;
    assert(user);
    database.vUserBetCancel(dataIndex, function(err, results) {
        if (err) {
            return next(new Error('Unable to Cancel: \n' + err));
        }
        res.redirect('/admin-virUser');
    });
};
exports.chatCancel = function(req, res, next) {
    var user = req.user;
	var uid = req.body.uid;
    assert(user);

	
    database.userChatCancel(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to Cancel: \n' + err));
        }
        res.redirect('/admin-con-user');
    });
};
exports.updateBalance = function(req, res, next) {

	var user = req.user;
    id = lib.removeNullsAndTrim(req.body.id);
	balance = lib.removeNullsAndTrim(req.body.balance);
	
	database.updateBalance(id, balance, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};
exports.updateBetsize = function(req, res, next) {

	var user = req.user;
    id = lib.removeNullsAndTrim(req.body.id);
	betsize = lib.removeNullsAndTrim(req.body.betsize);
	
	database.updateBetsize(id, betsize, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};
exports.updateBetval = function(req, res, next) {

	var user = req.user;
    id = lib.removeNullsAndTrim(req.body.id);
	betval = lib.removeNullsAndTrim(req.body.betval);
	
	database.updateBetval(id, betval, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};

exports.updateGameLog = function(req, res, next) {

	var user = req.user;
    id = lib.removeNullsAndTrim(req.query.id);
	page = lib.removeNullsAndTrim(req.query.page);
    // Added by jjb 2017.10.21.
    game_created = lib.removeNullsAndTrim(req.query.game_created);
    game_no = lib.removeNullsAndTrim(req.query.game_no);
    // End
	var limit = 10;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;
	}

	var offset = Number((page-1)*limit);
	database.getGameLog(id, game_created, game_no, limit, offset, function(err, result) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		user.results = result;
		user.page = page;
        // Added by jjb 2017.10.21.
        user.s_game_created = (!game_created)? '' : game_created;
        user.s_game_no      = (!game_no)? '' : game_no;
        user.s_user_id      = id;
        // End
		res.render('admin-gameLog', {user: user});
	});
};
exports.updatestopped = function(req, res, next) {

	var user = req.user;
    var game_id = lib.removeNullsAndTrim(req.body.game_id);
	var bal = lib.removeNullsAndTrim(req.body.balance);
	var bet = lib.removeNullsAndTrim(req.body.bet);
	var user_id = lib.removeNullsAndTrim(req.body.user_id);
	database.updatestopped(game_id, bal, bet, user_id, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};
exports.updatebettingsize = function(req, res, next) {

	var user = req.user;
    var game_id = lib.removeNullsAndTrim(req.body.game_id);
	var bal = lib.removeNullsAndTrim(req.body.balance);
	var user_id = lib.removeNullsAndTrim(req.body.user_id);
	var at = lib.removeNullsAndTrim(req.body.at);
	
	database.updatebettingsize(game_id, bal, user_id, at, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-virUser');
	});
};
/*exports.userList = function(req, res, next) {
	var user = req.user;
    assert(user);
	res.render('admin-user', {user: user});
};*/
exports.userLogout = function(req, res, next) {
	var user = req.user;
    uId = req.query.uId;
	

	database.expireSessionsByUserId(uId, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-user');
	});
};
exports.userList = function(req, res, next) {
    var user = req.user;
	var search_mode = lib.removeNullsAndTrim(req.query.search_mode);
	var fromValue = lib.removeNullsAndTrim(req.query.fromValue);
	var username='';
	var ip_addr='';
	var partner_code='';
	var value='';
	if(search_mode == '1')
		username = fromValue;
	else if(search_mode == '2')
		ip_addr = fromValue;
	else if(search_mode == '3')
		partner_code = fromValue;
	else if(search_mode == '0')
		value =  fromValue;
	if(!search_mode) search_mode = 'no';
	var page = lib.removeNullsAndTrim(req.query.page);
	var limit = 10;
    page = parseInt(page);
    if (!Number.isFinite(page) || page <= 0){
		page = 1;
	}
	var offset = Number((page-1)*limit);
    database.searchAdminUser(user.userclass, user.id, user.solecodeinput, username, ip_addr, partner_code, value, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
		user.search_mode = search_mode;
		user.fromValue = fromValue;
		res.render('admin-user', {user: user});
    });
};
exports.modifyUserInfo = function(req, res, next) {
    var user = req.user;
	var userid = lib.removeNullsAndTrim(req.body.userid);
	var password = lib.removeNullsAndTrim(req.body.password);
	var phone = lib.removeNullsAndTrim(req.body.phone);
	var memo = lib.removeNullsAndTrim(req.body.memo);
	var bank = lib.removeNullsAndTrim(req.body.bank);
	var owner = lib.removeNullsAndTrim(req.body.owner);
	var accountnum = lib.removeNullsAndTrim(req.body.accountnum);

	database.modifyUserInfo(userid, password, phone, memo, bank, owner, accountnum, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
        res.redirect('/admin-user');
    });
};

exports.getUserInfo = function(req, res, next) {
    var user = req.user;
	var userid = lib.removeNullsAndTrim(req.body.userid);
	database.getUserInfo(userid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		results.balance_satoshis = lib.formatSatoshis(results.balance_satoshis, 0);
		results.totalin = lib.formatSatoshis(results.totalin*100, 0);
		results.totalout = lib.formatSatoshis(results.totalout*100, 0);
		results.point = lib.formatSatoshis(results.point, 0);
		user.result = results;
        res.render('admin-user-info', {user: user});
    });
};
exports.userDetail = function(req, res, next) {
    var user = req.user;
	var username = lib.removeNullsAndTrim(req.body.username);
	var urlname = lib.removeNullsAndTrim(req.body.urlname);

	database.getUserDetail(username, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		if(results){
			results.inputmoney = lib.formatSatoshis(results.inputmoney*100, 0);
			results.outputmoney =  lib.formatSatoshis(results.outputmoney*100, 0);
			results.balance_satoshis = lib.formatSatoshis(results.balance_satoshis, 0);
			results.point = lib.formatSatoshis(results.point, 0);
		}
		user.results = results;
		if(urlname=='user') { user.viewok='ok'; }
        res.render('admin-user-detail', {user: user});
    });
};
exports.onlymodifyval = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.uid);
	var balance = Number(lib.removeNullsAndTrim(req.query.balance));
	var point = Number(lib.removeNullsAndTrim(req.query.point));
	console.log(balance);
	database.modifybalance(uid, balance, point, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
        res.redirect('/admin-user');
    });
};
exports.conmodifyval = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.uid);
	var balance = lib.removeNullsAndTrim(req.query.balance);
	var point = Number(lib.removeNullsAndTrim(req.query.point));
	database.modifybalance(uid, balance, point,  function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
        res.redirect('/admin-con-user');
    });
};
/*
exports.conUserList = function(req, res, next) {
	var user = req.user;
    assert(user);
	
	res.render('admin-con-user', {user: user});
};
*/
exports.conUserList = function(req, res, next) {
	var user = req.user;
	var search_mode = lib.removeNullsAndTrim(req.query.search_mode);
	var fromValue = lib.removeNullsAndTrim(req.query.fromValue);
	var username='';
	var ip_addr='';
	var partner_code='';
	var value='';
	if(search_mode == '1')
		username = fromValue;
	else if(search_mode == '2')
		ip_addr = fromValue;
	else if(search_mode == '3')
		partner_code = fromValue;
	else if(search_mode == '0')
		value =  fromValue;
	if(!search_mode) search_mode = 'no';
	var page = lib.removeNullsAndTrim(req.query.page);
	var limit = 10;
    page = parseInt(page);
    if (!Number.isFinite(page) || page <= 0){
		page = 1;
	}
	var offset = Number((page-1)*limit);
    database.searchAdminCon(user.userclass, user.id, user.solecodeinput, username, ip_addr, partner_code, value, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
		user.search_mode = search_mode;
		user.fromValue = fromValue;
		res.render('admin-con-user', {user: user});
    });
};
exports.modifyConInfo = function(req, res, next) {
    var user = req.user;
	var userid = lib.removeNullsAndTrim(req.body.userid);
	var password = lib.removeNullsAndTrim(req.body.password);
	var phone = lib.removeNullsAndTrim(req.body.phone);
	var memo = lib.removeNullsAndTrim(req.body.memo);
	var bank = lib.removeNullsAndTrim(req.body.bank);
	var owner = lib.removeNullsAndTrim(req.body.owner);
	var accountnum = lib.removeNullsAndTrim(req.body.accountnum);

	database.modifyUserInfo(userid, password, phone, memo, bank, owner, accountnum, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
        res.redirect('/admin-con-user');
    });
};

/*
exports.partnerList = function(req, res, next) {
	var user = req.user;
    
    res.render('admin-partner', { user:  user });

};*/
exports.partnerRegister = function(req, res, next) {
	var user = req.user;
	 res.render('partner-register', { user:  user });
};

exports.ptRegister = function(req, res, next) {
    var user = req.user;
	var name = lib.removeNullsAndTrim(req.body.name);
	var email = lib.removeNullsAndTrim(req.body.email);
	var password = lib.removeNullsAndTrim(req.body.password);
	var password2 = lib.removeNullsAndTrim(req.body.confirmation);
	var phone = lib.removeNullsAndTrim(req.body.phone);
	var partner_code = lib.removeNullsAndTrim(req.body.partner_code);
	var jibun = lib.removeNullsAndTrim(req.body.jibun);
	var pid = lib.removeNullsAndTrim(req.body.pid);
	var puid = lib.removeNullsAndTrim(req.body.puid);
	var pclass = lib.removeNullsAndTrim(req.body.pclass);
	var level = lib.removeNullsAndTrim(req.body.level);
    if (password !== password2) {
          return res.render('partner-register', {
          warning: '비밀번호가 동일하지 않습니다.'
        });
    }
	
	database.createPartner(user.userclass, user.id, pid, puid,  name, email, password, phone, partner_code, jibun, pclass, level, function(err, result) {
        if (err) {
            if (err === 'NAME_TAKEN') {
                return res.render('partner-register', { warning: '계정이 중복되었습니다.', user: user});
            }
			if (err === 'CODE_TAKEN') {
                return res.render('partner-register', { warning: '코드가 중복되었습니다.', user: user});
            }
            return next(new Error('Unable to register user: \n' + err));
        }
	
		res.redirect('/admin-partner');
    });
};
exports.partnerDelete = function(req, res, next) {
	var user = req.user;
    uId = req.query.uId;
	
	database.partnerDelete(uId, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		res.redirect('/admin-partner');
	});
};
exports.partnerModify = function(req, res, next) {
	var user = req.user;
    uId = req.query.uId;
	
	
	database.partnerModify(uId, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		user.result = content;
		res.render('partner-register', { user:  user });
	});
};
exports.partnerList = function(req, res, next) {
    var user = req.user;
	
	var name = lib.removeNullsAndTrim(req.query.name);
	var partner_code = lib.removeNullsAndTrim(req.query.partner_code);
	var page = lib.removeNullsAndTrim(req.query.page);
	var limit = 10;
    page = parseInt(page);
    if (!Number.isFinite(page) || page < 0){
		page = 1;
	}
	var offset = Number((page-1)*limit);
	database.ptSearch(user.userclass, user.id, name, partner_code, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		if(!name) name = '';
		if(!partner_code) partner_code = '';
		user.name = name;
		user.partner_code = partner_code;
		user.page = page;

		res.render('admin-partner', { user:  user });
    });
};
exports.partnercodeAuth = function(req, res, next) {
	var partner_code = lib.removeNullsAndTrim(req.body.partner_code);
	database.searchPartnercode(partner_code, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		result = content;
	
		res.render('partner_auth', { result:  result });
	});
};
exports.usernameAuth = function(req, res, next) {
	var username_auth = lib.removeNullsAndTrim(req.body.username_auth);
	database.searchusername(username_auth, function(err, content) {
		if (err) {
			return next(new Error('Unable to get content: \n' + err));
		}
		result = content;
	
		res.render('username_auth', { result:  result });
	});
};
exports.convertLocalTimezone = function(date){
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);  
};
exports.todayMoney = function(req, res, next) {
	var user = req.user;
	var param_year 	= lib.removeNullsAndTrim(req.query.year);
	var param_month = lib.removeNullsAndTrim(req.query.month);
	var username 	= lib.removeNullsAndTrim(req.query.username);
    if(req.body.username)
        username = req.body.username;
    if(req.body.year && req.body.year != null)
        param_year = req.body.year;
    if(req.body.month && req.body.month != null)
        param_month = req.body.month;

	var userflag = 0;
	if(username) {
		uname = username;
		//userflag = 1;
	}
	else if(!username){
		uname = user.username;
		//userflag = 0;
	}
    var today 		= new Date();
	var cur_year 	= (!param_year)? today.getFullYear() : param_year;
	var cur_month 	= (!param_month)? today.getMonth() : param_month;
	var from_date 	= (!param_year || !param_month)? new Date(cur_year, cur_month, 1) : new Date(cur_year, cur_month-1, 1);
    var to_date 	= (!param_year || !param_month)? new Date(cur_year, cur_month+1, 1) : new Date(cur_year, cur_month, 1);
    if(!param_year) param_year = today.getFullYear();
    if(!param_month) param_month = today.getMonth()+1;

	var f_date = from_date.toISOString().substring(0, 10);
	var t_date = to_date.toISOString().substring(0, 10);

    var table = '<table class="leaders">';
    table += '<thead>';
    table += '<tr>';
    table += '<td style="width:calc((100% - 5px) /7)"><font color="red"><b> 일 </b></font></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><b> 월 </b></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><b> 화 </b></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><b> 수 </b></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><b> 목 </b></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><b> 금 </b></td>';
    table += '<td style="width:calc((100% - 5px) /7)"><font color="blue"><b> 토 </b></font></td></tr>';
    table += '</thead>';
    table += '<br/>';

    var day = from_date.getDay();

    for(var i = 0; i < day; i++){
        table += '<td > &nbsp;</td>';
    }
    var settlementDate = [];
    var jibun = 0;
    database.getUserFromUsername(uname, function(err, results) {
        if(err) {  return next(new Error('Unable to get today Money: \n' + err)); };
        jibun = (results.userclass=='admin')? 100 : results.jibun;
        if(username){
        	user = results;
        }
        user.userclass = results.userclass;
        database.getSettlementDate(function(err, results){
        	if(err) console.log(err);
            settlementDate = results.rows;
		});
        
        database.getIOMoney(f_date, t_date, user.userclass, user.solecodeinput, function (err, results) {
            if (!results || results.rowCount == 0) {
                while (from_date.getMonth() == param_month - 1) {
                    if (from_date.getDate() != 1 && from_date.getDay() == 0) {
                        table += '<tr></tr>';
                    }
                    if (from_date.getDay() == "0") {
                        if (today == from_date.getDate())
                            table += '<td><font color="green">' + from_date.getDate() + '</font></td>';
                        else
                            table += '<td><font color="red">' + from_date.getDate() + '</font></td>';
                    } else if (from_date.getDay() == "6") {
                        if (today == from_date.getDate())
                            table += '<td><font color="green">' + from_date.getDate() + '</font></td>';
                        else
                            table += '<td><font color="blue">' + from_date.getDate() + '</font></td>';
                    } else {
                        if (today == from_date.getDate())
                            table += '<td><font color="green">' + from_date.getDate() + '</font></td>';
                        else
                            table += '<td>' + from_date.getDate() + '</td>';
                    }
                    from_date.setDate(from_date.getDate() + 1);
                }
                var nextFirstDay = from_date.getDay();
                if (nextFirstDay != 0) {
                    var last = 6 - nextFirstDay + 1;
                    for (var i = 0; i < last; i++) {
                        table += '<td> &nbsp; </td>';
                    }
                }
                table += '</tr></table>';
            }
            else {
                var monthTotalIn = 0;
                var monthTotalOut = 0;

                results.rows.forEach(function (data) {
                    monthTotalIn += Number(data.inmoney);
                    monthTotalOut += Number(data.outmoney);
                    // jibun = data.jibun;
                });
                while (from_date.getMonth() == param_month - 1) {
                    if (from_date.getDate() != 1 && from_date.getDay() == 0) {
                        table += '<tr style="border:1px solid #cccccc;"></tr>';
                    }
                    var flag = 0;
                    var dayIn = 0;
                    var dayOut = 0;
                    results.rows.forEach(function (data) {
                        if (data.datetime.substring(8, 10) == from_date.getDate()) {
                            dayIn += Number(data.inmoney);
                            dayOut += Number(data.outmoney);
                        }
                    });
                    if (dayIn != 0 || dayOut != 0) {
                        var settlementState = 0;
                        settlementDate.forEach(function(data){
                            var ff_date = data.from_date.toISOString().substring(0, 10);
                            var ee_date = data.end_date.toISOString().substring(0, 10);
                            var nn_date = exports.convertLocalTimezone(from_date);
							if(ff_date <= nn_date && nn_date <= ee_date){
                                settlementState = 1;
							}
						});
                        table += '<td style="width:calc((100% - 5px) /7); font-weight:bold;"><a href="/viewByuserIO?username=' + user.username + '&date=' + exports.convertLocalTimezone(from_date) + '">' + from_date.getDate() + '<br>';
                        table += '<font color="red" size="1px">' + lib.formatSatoshis(dayIn * 100, 0) + '원</font><br>';
                        table += '<font color="blue" size="1px">' + lib.formatSatoshis(dayOut * 100, 0) + '원</font><br>';
                        table += '<font color="green" size="1px">' + lib.formatSatoshis((dayIn - dayOut) * jibun, 0) + '원</font><br>';
                        if(settlementState == 1) table += '<font color="green" size="1px">정산만료</font>';
                        table += '</td>';
                        flag = 1;
                    }
                    if (flag == 0) {
                        table += '<td style="width:calc((100% - 5px) /7); font-weight:bold;"><a href="/viewByuserIO?username=' + user.username + '&date=' + exports.convertLocalTimezone(from_date) + '">' + from_date.getDate() + '<br>';
                        table += '<font color="red" size="1px">0원</font><br>';
                        table += '<font color="blue" size="1px">0원</font><br>';
                        table += '</td>';
                    }
                    from_date.setDate(from_date.getDate() + 1);
                }
                var nextFirstDay = from_date.getDay();
                if (nextFirstDay != 0) {
                    var last = 6 - nextFirstDay + 1;
                    for (var i = 0; i < last; i++) {
                        table += '<td> &nbsp; </td>';
                    }
                }
                table += '</tr></table>';
            }
            
            database.totalinout(user.userclass, user.id, user.username, user.solecodeinput, function (err, result) {
                if (err) return next(new Error('Unable to get today Money: \n' + err));
                user.table = table;
                user.date2 = today.toISOString().substring(0, 10);
                user.date1 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
                user.year 	= param_year;
                user.month 	= param_month;
                user.monthin 	= lib.formatSatoshis(monthTotalIn * 100, 0);
                user.monthout 	= lib.formatSatoshis(monthTotalOut * 100, 0);
                user.monthprofit = lib.formatSatoshis((monthTotalIn - monthTotalOut) * jibun, 0);
				//user.userclass = user.userclass;
                if (!result) {
                    user.totalin 		= 0;
                    user.totalout 		= 0;
                    user.profit 		= 0;
                    user.total_bal 		= 0;
                    user.total_point 	= 0;
                }
                else {
                    user.totalin 	= lib.formatSatoshis(result.total_in * 100, 0);
                    user.totalout 	= lib.formatSatoshis(result.total_out * 100, 0);
                    user.profit 	= lib.formatSatoshis((result.profit * Number(jibun)), 0);
                    user.total_bal 	= lib.formatSatoshis(result.total_bal, 0);
                    user.total_point = lib.formatSatoshis(result.total_point, 0);
                }
                if(!username && user.userclass == 'partner')
                	user.userflag = 0;
                if(username && user.userclass == 'partner')
                	user.userflag = 1;
                if(!username && user.userclass == 'distributor')
                    user.userflag = 0;
                if(username && user.userclass == 'distributor')
                    user.userflag = 1;
                if(user.userclass == 'admin')
                    user.userflag = 0;
                if (req.body.username || req.body.year || req.body.month)
                    res.send(user);
                else
                    res.render('admin-todaymoney', {user: user});
            });
        });
    });
};
exports.refreshTodayMoney = function(req, res, next){
    exports.todayMoney(req, res, next);
};
exports.viewByuserIO = function(req, res, next) {
    var user = req.user;
	var sdate = lib.removeNullsAndTrim(req.query.date);
	var username = lib.removeNullsAndTrim(req.query.username);
	database.getUserFromUsername(username, function(err, results){
		user = results;
		database.getBydateIn(user.id, user.userclass, user.solecodeinput, sdate, function(err, moneyIn) {
			if (err) {
				return next(new Error('Unable to get money: \n' + err));
			};
			user.moneyIn = moneyIn;
			var totalin=0;
			moneyIn.forEach(function(data) {
				totalin += Number(data.balance.replace(/,/g, ''));
			});
			user.totalin = lib.formatSatoshis(totalin*100, 0);
			database.getBydateOut(user.id, user.userclass, user.solecodeinput, sdate, function(err, results) {
				if (err) {
					return next(new Error('Unable to get money: \n' + err));
				};
				user.moneyOut = results;
				var totalout=0;
				results.forEach(function(data) {
					totalout += Number(data.balance.replace(/,/g, ''));
				});
				user.totalout = lib.formatSatoshis(totalout*100, 0);
				database.getBydateSet(user.id, user.userclass, user.solecodeinput, sdate, function(err, results) {
					if (err) {
						return next(new Error('Unable to get money: \n' + err));
					};
					user.moneySet = results;
					var totalset=0;
					results.forEach(function(data) {
						totalset += Number(data.profit.replace(/,/g, ''));
					});
					user.totalset = lib.formatSatoshis(totalset*100, 0);
                    user.username = username;
					res.render('viewByuserIO', {user: user});
				});
			});
		});
	});
};
exports.dateSearch = function(req, res, next) {
    var user = req.user;
	var fromdate = lib.removeNullsAndTrim(req.body.fromdate);
	var enddate = lib.removeNullsAndTrim(req.body.enddate);
	var solecode = lib.removeNullsAndTrim(req.body.solecode);
	var uclass = lib.removeNullsAndTrim(req.body.uclass);
	if(!solecode) solecode = user.solecodeinput;
	if(!uclass) uclass = user.userclass;

	database.dateSearch(uclass, solecode, fromdate, enddate, function(err, results) {
        if (err) {
            return next(new Error('Unable to get today Money: \n' + err));
        };
		user.results = results;
		user.fromdate = fromdate;
		user.enddate = enddate;

		res.render('admin-todaymoney-result', { user:  user });
    });
};

exports.infoFormat = function(req, res, next) {
    var user = req.user;
	var fromdate = lib.removeNullsAndTrim(req.body.fromdate);
	var enddate = lib.removeNullsAndTrim(req.body.enddate);

	database.infoFormat(user.userclass, user.solecodeinput, fromdate, enddate, function(err, results) {
        if (err) {
            return next(new Error('Unable to get today Money: \n' + err));
        };
		res.redirect('/admin-todaymoney');
    });
};
exports.tmViewDetail = function(req, res, next) {
	var user = req.user;
	var fromdate = req.query.fromdate;
	var enddate = req.query.enddate;
	var solecode = lib.removeNullsAndTrim(req.query.solecode);
	var userclass = lib.removeNullsAndTrim(req.query.userclass);
	if(!solecode){
		solecode = user.solecodeinput;
        userclass = user.userclass;
    }
	user.fromdate = fromdate;
	user.enddate = enddate;
	database.viewDetailSettlement(userclass, solecode, fromdate, enddate, function(err, results) {
		 if (err) {
            return next(new Error('Unable to get today Money: \n' + err));
        };
		user.results = results
		res.render('admin-todayViewDetail', { user:  user });
	});
};
exports.viewByCode = function(req, res, next) {
	var user = req.user;
	var code = req.query.code;
	user.code = code;
	res.render('admin-viewDetailByCode', { user:  user });
};
exports.todaymoneyByUser = function(req, res, next) {
    var user = req.user;
	
	var username = lib.removeNullsAndTrim(req.body.username);
	var date = lib.removeNullsAndTrim(req.body.date);
	//var page = lib.removeNullsAndTrim(req.body.page);
	database.todaymoneyByUser(user.userclass, user.id, user.solecodeinput, username, date, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		user.results = results;
        res.render('admin-todaybyuser-result', { user:  user });
    });
};
exports.setPlay = function(req, res, next) {
    var user = req.user;
	
	var uid = lib.removeNullsAndTrim(req.body.uid);
	database.setPlayGame(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-user');
    });
};
exports.badip = function(req, res, next) {
    var user = req.user;

	database.badiplist(function(err, results) {
        if (err) {
            return next(new Error('Unable to get badipList: \n' + err));
        };
		user.results = results;
		res.render('admin-badip', {user: user});
    });
};
exports.badipDelete = function(req, res, next) {
    var user = req.user;
	
	var uid = lib.removeNullsAndTrim(req.query.uid);
	database.badipDelete(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-badip');
    });
};
exports.addbadip = function(req, res, next) {
    var user = req.user;
	
	var badip = lib.removeNullsAndTrim(req.query.badip);
	database.badipAdd(badip, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-badip');
    });
};
exports.maxprofit = function(req, res, next) {
	var user = req.user;
	database.bonusEnvironment(function(err, results) {
        if (err) {
            return next(new Error('Unable to get badipList: \n' + err));
        };
		user.bresult = results;
		database.exchangeEnvironment(function(err, result) {
			if (err) {
				return next(new Error('Unable to get badipList: \n' + err));
			};
			user.eresult = result;
			res.render('admin-maxprofit', { user:  user });
		});
	});
};
exports.modifymax = function(req, res, next) {
	var user = req.user;
	var maxprofit = lib.removeNullsAndTrim(req.body.money);
	database.modifymax(maxprofit, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-maxprofit');
    });
};
exports.account = function(req, res, next) {
    var user = req.user;

	database.accountlist(function(err, results) {
        if (err) {
            return next(new Error('Unable to get badipList: \n' + err));
        };
		user.results = results;
		res.render('admin-account', {user: user});
    });
};
exports.insertAccount = function(req, res, next) {
    var user = req.user;
	
	var bank = lib.removeNullsAndTrim(req.query.bank);
	var accountnum = lib.removeNullsAndTrim(req.query.accountnum);
	var owner = lib.removeNullsAndTrim(req.query.owner);
	var memo = lib.removeNullsAndTrim(req.query.memo);

	database.insertAccount(bank, accountnum, owner, memo, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-account');
    });
};

exports.modifyAccount = function(req, res, next) {
    var user = req.user;
	
	var bank = lib.removeNullsAndTrim(req.body.bank);
	var accountnum = lib.removeNullsAndTrim(req.body.accountnum);
	var owner = lib.removeNullsAndTrim(req.body.owner);
	var memo = lib.removeNullsAndTrim(req.body.memo);
	var uid = lib.removeNullsAndTrim(req.body.uid);
	database.modifyAccount(bank, accountnum, owner, memo, uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-account');
    });
};
exports.deleteAccount = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.uid);

	database.deleteAccount(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-account');
    });
};
exports.selectAccount = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.uid);
	var state = lib.removeNullsAndTrim(req.query.state);
	database.selectAccount(uid, state, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-account');
    });
};
exports.codeByList = function(req, res, next) {
	var user = req.user;
	var code = lib.removeNullsAndTrim(req.query.code);
	var username='';
	var ip_addr='';
	var value='';
	var partner_code=code;
	var page = lib.removeNullsAndTrim(req.body.page);
	var limit = 10;
    page = parseInt(page);
    if (!Number.isFinite(page) || page <= 0){
		page = 1;
	}
	var offset = Number((page-1)*limit);
    database.searchAdminUser(user.userclass, user.id, user.solecodeinput, username, ip_addr, partner_code, value, limit, offset, function(err, results) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.results = results;
		user.page = page;
		user.code = code;
		res.render('admin-codebylist', {user: user});
	});
};
exports.viewInOutput = function(req, res, next) {
    var user = req.user;
    // Added by jjb 2017.10.21.
    var q_page = req.query.page;
    var q_target = req.query.target;
    var limit = 5;
    var page1 = 1;
    var page2 = 1;
    var page3 = 1;
    if(q_page && q_target){
        if(q_target == 1) page1 = q_page;
        if(q_target == 2) page2 = q_page;
        if(q_target == 3) page3 = q_page;
    }
    var page = 1;
	var offset1 = Number((page1-1)*limit);
    var offset2 = Number((page2-1)*limit);
    var offset3 = Number((page3-1)*limit);
    // End
	var userid = lib.removeNullsAndTrim(req.query.uid);
	database.getInputInfo(user.userclass, userid, limit, offset1, function(err, moneyIn) {
        if (err) {
            return next(new Error('Unable to get money: \n' + err));
        };
		user.moneyIn = moneyIn;
		database.getOutputInfo(user.userclass, userid, limit, offset2, function(err, results) {
			if (err) {
				return next(new Error('Unable to get money: \n' + err));
			};
			user.moneyOut = results
			database.getPointInfo(user.userclass, userid, limit, offset3, function(err, results) {
				if (err) {
					return next(new Error('Unable to get money: \n' + err));
				};
				user.moneyPoint = results
				database.getSumIO(userid, function(err, results) {
					if (err) {
						return next(new Error('Unable to get money: \n' + err));
					};
					user.userid = userid;
					user.totalIn = lib.formatSatoshis(results.total_in*100, 0);
					user.totalOut =  lib.formatSatoshis(results.total_out*100, 0);
					user.totalPoint =  lib.formatSatoshis(results.total_point*100, 0);
                    user.page1 = page1;
                    user.page2 = page2;
                    user.page3 = page3;
					res.render('viewInOutput', {user: user});
				});
			});
		});
	});
};
exports.moneyInDelete = function(req, res, next) {
    var user = req.user;
	var id = lib.removeNullsAndTrim(req.query.id);
	var uid = lib.removeNullsAndTrim(req.query.uid);
	database.moneyInDelete(id, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/viewInOutput?uid='+uid);
    });
};
exports.moneyOutDelete = function(req, res, next) {
    var user = req.user;
	var id = lib.removeNullsAndTrim(req.query.id);
	var uid = lib.removeNullsAndTrim(req.query.uid);
	database.moneyOutDelete(id, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/viewInOutput?uid='+uid);
    });
};
exports.forceout = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.userid);
	var page = lib.removeNullsAndTrim(req.query.page);
	database.forceout(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-con-user?page='+page);
    });
};
exports.cancelout = function(req, res, next) {
    var user = req.user;
	var uid = lib.removeNullsAndTrim(req.query.userid);
	var page = lib.removeNullsAndTrim(req.query.page);
	database.cancelout(uid, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-user?page='+page);
    });
};
exports.todaySettlement = function(req, res, next) {
    var user = req.user;
	var bydate1 = lib.removeNullsAndTrim(req.body.bydate1);
	var bydate2 = lib.removeNullsAndTrim(req.body.bydate2);
	/*var tasks = [
		 function(callback) {
			setTimeout(function() {
				database.todaySettlement(bydate1, bydate2, callback);
			}, 400);
		},
		function(callback) {
			setTimeout(function() {
				database.settlementFinish(bydate1, bydate2, callback);
			},200); 
		}
	];
	async.series(tasks, function(err, ret) {
		if (err)
            return next(new Error('Unable to get account info: \n' + err));
		res.redirect('/admin-todaymoney');
	});*/
	
	database.todaySettlement(bydate1, bydate2, user.username, function(err, results) {
        if (err) {
           return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-todaymoney');
    });
};
exports.viewPartner = function(req, res, next) {
    var user = req.user;
	database.viewPartnerList(user.id, user.userclass, user.solecodeinput, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		user.results = results;
		res.render('admin-partnerlist', {user: user});
    });
};
exports.viewPartner1 = function(req, res, next) {
    var user = req.user;
    var solecode = lib.removeNullsAndTrim(req.query.solecode);
    var backcode = lib.removeNullsAndTrim(req.query.backcode);
    if(backcode){
		database.findParentCode(backcode, function(err, result){
            database.viewPartnerList1(result.partner_code, function(err, results) {
                if (err) {
                    return next(new Error('Unable to get todayList: \n' + err));
                };
                user.results = results;
                res.render('admin-partnerlist', {user: user});
            });
		});
	}
	else {
        if (!solecode) solecode = user.solecodeinput;
        database.viewPartnerList1(solecode, function (err, results) {
            if (err) {
                return next(new Error('Unable to get todayList: \n' + err));
            }
            ;
            user.results = results;
            res.render('admin-partnerlist', {user: user});
        });
    }
};
exports.balanceAccount = function(req, res, next) {
	
    var user = req.user;
	
	var username = lib.removeNullsAndTrim(req.query.username);
	var bydate1 = lib.removeNullsAndTrim(req.query.fromdate);
	var bydate2 = lib.removeNullsAndTrim(req.query.enddate);
	var today = new Date();
	var date2 = today.toISOString().substring(0, 10);
	var date1 = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);	
	if(!bydate2) bydate2 = date2;
	if(!bydate1) bydate1 = date1;
	database.getUserFromUsername(username, function(err, results){
		user = results;
		database.viewBalAccount(user.id, user.solecodeinput, user.userclass, user.username, bydate1, bydate2, function(err, results) {
			if (err) {
				return next(new Error('Unable to get todayList: \n' + err));
			};
			user.results = results;
			var total_in = 0;
			var total_out = 0;
			var total_profit = 0;
			results.forEach(function(value) {
                total_in += Number(value.totalin.replace(/,/g, ''));
                total_out += Number(value.totalout.replace(/,/g, ''));
                total_profit += Number(value.profit.replace(/,/g, ''));
			});
            user.total_in = lib.formatSatoshis(total_in*100, 0);
            user.total_out = lib.formatSatoshis(total_out*100, 0);
            if(user.userclass == 'admin') {
                user.total_profit = lib.formatSatoshis((total_in-total_out)*100, 0);
            }else user.total_profit = lib.formatSatoshis(total_profit*100, 0);
            user.date1 = bydate1;
            user.date2 = bydate2;
            res.render('admin-balance-account', {user: user});
            /*
			database.gettotalProfit(bydate1, bydate2, function(err, result) {
				if (err) {
					return next(new Error('Unable to get todayList: \n' + err));
				};
				user.total_in = lib.formatSatoshis(total_in*100, 0);
                user.total_out = lib.formatSatoshis(total_out*100, 0);
				if(user.userclass == 'admin') {
					user.total_profit = lib.formatSatoshis((total_in-total_out)*100, 0);
				}else user.total_profit = lib.formatSatoshis(total_in-total_out, 0);
				user.date1 = bydate1;
				user.date2 = bydate2;
				res.render('admin-balance-account', {user: user});
			});
			*/
		});
	});
};
/*
exports.searchBalAccount = function(req, res, next) {
    var user = req.user;
	var bydate1 = lib.removeNullsAndTrim(req.body.fromdate);
	var bydate2 = lib.removeNullsAndTrim(req.body.enddate);
	var username = lib.removeNullsAndTrim(req.body.username);
	database.getUserFromUsername(username, function(err, results){
		user = results;
		
		database.viewBalAccount(user.id, user.solecodeinput, bydate1, bydate2, function(err, results) {
			if (err) {
				return next(new Error('Unable to get todayList: \n' + err));
			};
			database.gettotalProfit(user.solecodeinput, bydate1, bydate2, function(err, result) {
				if (err) {
					return next(new Error('Unable to get todayList: \n' + err));
				};
				user.total = lib.formatSatoshis(result.total, 0);
				
				if(user.userclass == 'admin') {
					user.atotal = lib.formatSatoshis(result.atotal, 0);
					user.profit = lib.formatSatoshis((Number(result.total) - Number(result.atotal)), 0);
				}
				user.results = results;
				res.render('admin-balance-result', {user: user});
			});
		});
	});
};
*/
exports.registerBonus = function(req, res, next) {
    var user = req.user;
	var join_first = lib.removeNullsAndTrim(req.body.join_first);
	var real_first = lib.removeNullsAndTrim(req.body.real_first);
	var real_charge = lib.removeNullsAndTrim(req.body.real_charge);
	database.registerBonus(join_first, real_first, real_charge, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-maxprofit');
    });
};
exports.registerExchange = function(req, res, next) {
    var user = req.user;
	var game_play = lib.removeNullsAndTrim(req.body.game_play);
	var exchange_time = lib.removeNullsAndTrim(req.body.exchange_time);
	database.registerExchange(game_play, exchange_time, function(err, results) {
        if (err) {
            return next(new Error('Unable to get todayList: \n' + err));
        };
		res.redirect('/admin-maxprofit');
    });
};