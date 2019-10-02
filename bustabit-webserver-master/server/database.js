var assert = require('assert');
var uuid = require('uuid');
var config = require('../config/config');

var async = require('async');
var lib = require('./lib');
var pg = require('pg');
var passwordHash = require('password-hash');
var speakeasy = require('speakeasy');
var m = require('multiline');

var databaseUrl = config.DATABASE_URL;

if (!databaseUrl)
    throw new Error('must set DATABASE_URL environment var');

console.log('DATABASE_URL: ', databaseUrl);

pg.types.setTypeParser(20, function(val) { // parse int8 as an integer
    return val === null ? null : parseInt(val);
});

// callback is called with (err, client, done)
function connect(callback) {
    return pg.connect(databaseUrl, callback);
}

function query(query, params, callback) {
    //third parameter is optional
    if (typeof params == 'function') {
        callback = params;
        params = [];
    }

    doIt();
    function doIt() {
        connect(function(err, client, done) {
            if (err) return callback(err);
            client.query(query, params, function(err, result) {
                done();
                if (err) {
                    if (err.code === '40P01') {
                        console.log('Warning: Retrying deadlocked transaction: ', query, params);
                        return doIt();
                    }
                    return callback(err);
                }

                callback(null, result);
            });
        });
    }
}

exports.query = query;

pg.on('error', function(err) {
    console.error('POSTGRES EMITTED AN ERROR', err);
});


// runner takes (client, callback)

// callback should be called with (err, data)
// client should not be used to commit, rollback or start a new transaction

// callback takes (err, data)

function getClient(runner, callback) {
    doIt();

    function doIt() {
        connect(function (err, client, done) {
            if (err) return callback(err);

            function rollback(err) {
                client.query('ROLLBACK', done);

                if (err.code === '40P01') {
                    console.log('Warning: Retrying deadlocked transaction..');
                    return doIt();
                }

                callback(err);
            }

            client.query('BEGIN', function (err) {
                if (err)
                    return rollback(err);

                runner(client, function (err, data) {
                    if (err)
                        return rollback(err);

                    client.query('COMMIT', function (err) {
                        if (err)
                            return rollback(err);

                        done();
                        callback(null, data);
                    });
                });
            });
        });
    }
}


//Returns a sessionId
exports.createUser = function(username, nameid, password, solecodeinput, phone, depositname, bankIndex, accountnum, ipAddress, userAgent, addDomain, callback) {
    assert(username && password);
	
    getClient(
        function(client, callback) {
            //var hashedPassword = passwordHash.generate(password);
            client.query('SELECT COUNT(*) count FROM users WHERE lower(username) = lower($1)', [username],
                function(err, data) {
                    if (err) return callback(err);
                    assert(data.rows.length === 1);
                    if (data.rows[0].count > 0)
                        return callback('USERNAME_TAKEN');
                    client.query('INSERT INTO users(username, password, solecodeinput, phone, deposit_name, bankindex, accountnum, nameid) VALUES($1, $2, $3, $4 ,$5, $6, $7, $8) RETURNING id',
                            [username, password, solecodeinput, phone, depositname, bankIndex, accountnum, nameid],
                            function(err, data) {
                                if (err)  {
                                    if (err.code === '23505')
                                        return callback('USERNAME_TAKEN');
                                    else
                                        return callback(err);
                                }
                                assert(data.rows.length === 1);
                                var user = data.rows[0];
								//add by lt
								//createJoin(client, user.id, ipAddress, userAgent, addDomain);
                                createJoin(client, user.id, ipAddress, userAgent, addDomain, false, callback);
                            }
                        );

                    });
        }
    , callback);
};
/*
exports.updateEmail = function(userId, email, callback) {
    assert(userId);

    query('UPDATE users SET email = $1 WHERE id = $2', [email, userId], function(err, res) {
        if(err) return callback(err);

        assert(res.rowCount === 1);
        callback(null);
    });

};
*/

exports.changeUserPassword = function(userId, password, callback) {
    assert(userId && password && callback);
   // var hashedPassword = passwordHash.generate(password);
    query('UPDATE users SET password = $1 WHERE id = $2', [password, userId], function(err, res) {
        if (err) return callback(err);
        assert(res.rowCount === 1);
        callback(null);
    });
};

exports.updateMfa = function(userId, secret, callback) {
    assert(userId);
    query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, userId], callback);
};

// Possible errors:
//   NO_USER, WRONG_PASSWORD, INVALID_OTP
exports.validateUser = function(username, password, otp, ip_addr, callback) {
    assert(username && password);
	query('SELECT id FROM bad_ip WHERE ip_addr = $1', [ip_addr], function(err, data) {
		if(err) return callback(err);
		if(data.rows.length > 0)  return callback('NO_IP');

		query('SELECT id, password, mfa_secret, playisok, outisok FROM users WHERE lower(username) = lower($1)', [username], function (err, data) {
			if (err) return callback(err);

			if (data.rows.length === 0)
				return callback('NO_USER');

			var user = data.rows[0];
			//console.log(user.password);
			//console.log(password);
			//console.log(passwordHash.generate(password));
			//var verified = passwordHash.verify(password, user.password);
			//console.log(verified);
			if (user.password != password)
				return callback('WRONG_PASSWORD');

			if (user.mfa_secret) {
				if (!otp) return callback('INVALID_OTP'); // really, just needs one

				var expected = speakeasy.totp({ key: user.mfa_secret, encoding: 'base32' });

				if (otp !== expected)
					return callback('INVALID_OTP');
			}
			if(user.outisok == 1)
				return callback('NO_LOGIN');
			if(user.playisok == 0)
				return callback('NO_PLAY');
			
			callback(null, user.id);
		});
	});
};
exports.validateSession = function(username, callback) {
    assert(username);
    query('SELECT sessions.id  FROM sessions left join users on users.id = sessions.user_id WHERE ott = false and expired > now() and users.username = $1', [username], function (err, data) {
		 if (data.rows.length == 1){
			var sessionid = data.rows[0].id;
			 query('UPDATE sessions SET expired = now() WHERE id = $1', [sessionid], function(err, result){
					if(err) return callback(err);
			 });
		 }
		 callback(null, data);
    });
};

exports.validateAdmin = function(username, password, otp, callback) {
    assert(username && password);

    query('SELECT id, password, mfa_secret FROM users WHERE lower(username) = lower($1)', [username], function (err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0)
            return callback('NO_USER');

        var user = data.rows[0];

        //var verified = passwordHash.verify(password, user.password);
        if (user.password != password)
            return callback('WRONG_PASSWORD');

        if (user.mfa_secret) {
            if (!otp) return callback('INVALID_OTP'); // really, just needs one

            var expected = speakeasy.totp({ key: user.mfa_secret, encoding: 'base32' });

            if (otp !== expected)
                return callback('INVALID_OTP');
        }
		
        callback(null, user.id);
    });
};

/** Expire all the not expired sessions of an user by id **/
exports.expireSessionsByUserId = function(userId, callback) {
    assert(userId);

    query('UPDATE sessions SET expired = now() WHERE user_id = $1 AND expired > now()', [userId], callback);
};
exports.setlogcnt = function(userId, callback) {
    assert(userId);

    query('UPDATE users SET logcnt =logcnt+1 WHERE id = $1', [userId], callback);
};

function createSession(client, userId, ipAddress, userAgent, remember, callback) {
    var sessionId = uuid.v4();

    var expired = new Date();

    if (remember)
        expired.setFullYear(expired.getFullYear() + 10);
    else
        expired.setDate(expired.getDate() + 21);

    client.query('INSERT INTO sessions(id, user_id, ip_address, user_agent, expired) VALUES($1, $2, $3, $4, $5) RETURNING id',
        [sessionId, userId, ipAddress, userAgent, expired], function(err, res) {
        if (err) return callback(err);
        assert(res.rows.length === 1);

        var session = res.rows[0];
        assert(session.id);
        callback(null, session.id, expired);
    });
}
function createJoin(client, userId, ipAddress, userAgent, addDomain, remember, callback) {
	var sessionId = uuid.v4();

    var expired = new Date();
    if (remember)
        expired.setFullYear(expired.getFullYear() + 10);
    else
        expired.setDate(expired.getDate() + 21);

    client.query('INSERT INTO user_join(user_id, join_ip, join_agent, join_domain, expired) VALUES($1, $2, $3, $4, $5)',
        [userId, ipAddress, userAgent, addDomain, expired], function(err, res) {
        if (err) return callback(err);
			 /*client.query('INSERT INTO sessions(id, user_id, ip_address, user_agent, expired) VALUES($1, $2, $3, $4, $5) RETURNING id',
					[sessionId, userId, ipAddress, userAgent, expired], function(err, res) {
					if (err) return callback(err);
					assert(res.rows.length === 1);

					var session = res.rows[0];
					assert(session.id);

					callback(null, session.id, expired);
			});*/
		callback(null, res);
    });
}

exports.createOneTimeToken = function(userId, ipAddress, userAgent, callback) {
    assert(userId);
    var id = uuid.v4();

    query('INSERT INTO sessions(id, user_id, ip_address, user_agent,  ott) VALUES($1, $2, $3, $4, true) RETURNING id', [id, userId, ipAddress, userAgent], function(err, result) {
        if (err) return callback(err);
        assert(result.rows.length === 1);

        var ott = result.rows[0];

        callback(null, ott.id);
    });
};

exports.createSession = function(userId, ipAddress, userAgent, remember, callback) {
    assert(userId && callback);

    getClient(function(client, callback) {
        createSession(client, userId, ipAddress, userAgent, remember, callback);
    }, callback);

};

exports.getUserFromUsername = function(username, callback) {
    assert(username && callback);

    query('SELECT users.*, partner.jibun FROM users_view AS users LEFT JOIN partner ON users.username=partner.name WHERE lower(users.username) = lower($1)', [username], function(err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0)
            return callback('NO_USER');

        assert(data.rows.length === 1);
        var user = data.rows[0];
        assert(typeof user.balance_satoshis === 'number');

        callback(null, user);
    });
};
exports.getUserFromId = function(userid, callback) {

    assert(userid && callback);

    query('SELECT * FROM users_view WHERE id = $1', [userid], function(err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0)
            return callback('NO_USER');

        assert(data.rows.length === 1);
        var user = data.rows[0];
        assert(typeof user.balance_satoshis === 'number');

        callback(null, user);
    });
};
exports.getUserIdFromUsername = function(username, callback) {
    query('SELECT id FROM users WHERE username = $1', [username], function(err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0)
            return callback('NO_USER');

        assert(data.rows.length === 1);
        var user = data.rows[0];
        
        callback(null, user);
    });
};

/*
exports.getUsersFromEmail = function(email, callback) {
    assert(email, callback);

    query('select * from users where email = lower($1)', [email], function(err, data) {
       if (err) return callback(err);

        if (data.rows.length === 0)
            return callback('NO_USERS');

        callback(null, data.rows);

    });
};
*/
exports.addRecoverId = function(userId, ipAddress, callback) {
    assert(userId && ipAddress && callback);

    var recoveryId = uuid.v4();

    query('INSERT INTO recovery (id, user_id, ip)  values($1, $2, $3)', [recoveryId, userId, ipAddress], function(err, res) {
        if (err) return callback(err);
        callback(null, recoveryId);
    });
};

exports.getUserBySessionId = function(sessionId, callback) {
    assert(sessionId && callback);
    query('SELECT * FROM users_view WHERE id = (SELECT user_id FROM sessions WHERE id = $1 AND ott = false AND expired > now())', [sessionId], function(err, response) {
        if (err) return callback(err);

        var data = response.rows;
        if (data.length === 0)
            return callback('NOT_VALID_SESSION');

        assert(data.length === 1);

        var user = data[0];
        assert(typeof user.balance_satoshis === 'number');

        callback(null, user);
    });
};

exports.getUserByValidRecoverId = function(recoverId, callback) {
    assert(recoverId && callback);
    query('SELECT * FROM users_view WHERE id = (SELECT user_id FROM recovery WHERE id = $1 AND used = false AND expired > NOW())', [recoverId], function(err, res) {
        if (err) return callback(err);

        var data = res.rows;
        if (data.length === 0)
            return callback('NOT_VALID_RECOVER_ID');

        assert(data.length === 1);
        return callback(null, data[0]);
    });
};

exports.getUserByName = function(username, callback) {
    assert(username);
    query('SELECT * FROM users WHERE lower(username) = lower($1)', [username], function(err, result) {
        if (err) return callback(err);
        if (result.rows.length === 0)
            return callback('USER_DOES_NOT_EXIST');

        assert(result.rows.length === 1);
        callback(null, result.rows[0]);
    });
};

/* Sets the recovery record to userd and update password */
exports.changePasswordFromRecoverId = function(recoverId, password, callback) {
    assert(recoverId && password && callback);
    var hashedPassword = passwordHash.generate(password);

    var sql = m(function() {/*
     WITH t as (UPDATE recovery SET used = true, expired = now()
     WHERE id = $1 AND used = false AND expired > now()
     RETURNING *) UPDATE users SET password = $2 where id = (SELECT user_id FROM t) RETURNING *
     */});

    query(sql, [recoverId, hashedPassword], function(err, res) {
            if (err)
                return callback(err);

            var data = res.rows;
            if (data.length === 0)
                return callback('NOT_VALID_RECOVER_ID');

            assert(data.length === 1);

            callback(null, data[0]);
        }
    );
};

exports.getGame = function(gameId, callback) {
    assert(gameId && callback);

    query("SELECT games.id, game_no, to_char(games.created, 'YYYY-MM-DD') as dcreated, games.game_crash as crash, to_char(games.created, 'YYYY-MM-DD HH24:MI:SS') as created, games.ended, game_hashes.game_id, game_hashes.hash, game_hashes.game_crash FROM games " +
    "LEFT JOIN game_hashes ON games.id = game_hashes.game_id " +
    "WHERE games.id = $1 AND games.ended = TRUE", [gameId], function(err, result) {
        if (err) return callback(err);
        if (result.rows.length == 0) return callback('GAME_DOES_NOT_EXISTS');
        assert(result.rows.length == 1);
        callback(null, result.rows[0]);
    });
};

exports.getGamesPlays = function(gameId, callback) {
    query('SELECT u.username, p.bet, p.cash_out, p.bonus FROM plays p, users u ' +
        ' WHERE game_id = $1 AND p.user_id = u.id ORDER by p.cash_out/p.bet::float DESC NULLS LAST, p.bet DESC', [gameId],
        function(err, result) {
            if (err) return callback(err);
            return callback(null, result.rows);
        }
    );
};

function addSatoshis(client, userId, amount, callback) {

    client.query('UPDATE users SET balance_satoshis = balance_satoshis + $1 WHERE id = $2', [amount, userId], function(err, res) {
        if (err) return callback(err);
        assert(res.rowCount === 1);
        callback(null);
    });
}

exports.getUserPlays = function(userId, limit, offset, callback) {
    assert(userId);

    query('SELECT p.bet, p.bonus, p.cash_out, p.created, p.game_id, g.game_no, g.game_crash FROM plays p ' +
        'LEFT JOIN (SELECT * FROM games) g ON g.id = p.game_id ' +
        'WHERE p.user_id = $1 AND g.ended = true ORDER BY p.id DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset], function(err, result) {
            if (err) return callback(err);
            callback(null, result.rows);
        }
    );
};

exports.getGiveAwaysAmount = function(userId, callback) {
    assert(userId);
    query('SELECT SUM(g.amount) FROM giveaways g where user_id = $1', [userId], function(err,result) {
        if (err) return callback(err);
        return callback(null, result.rows[0]);
    });
};

exports.addGiveaway = function(userId, callback) {
    assert(userId && callback);
    getClient(function(client, callback) {

            client.query('SELECT last_giveaway FROM users_view WHERE id = $1', [userId] , function(err, result) {
                if (err) return callback(err);

                if (!result.rows) return callback('USER_DOES_NOT_EXIST');
                assert(result.rows.length === 1);
                var lastGiveaway = result.rows[0].last_giveaway;
                var eligible = lib.isEligibleForGiveAway(lastGiveaway);

                if (typeof eligible === 'number') {
                    return callback({ message: 'NOT_ELIGIBLE', time: eligible});
                }

                var amount = 200; // 2 bits
                client.query('INSERT INTO giveaways(user_id, amount) VALUES($1, $2) ', [userId, amount], function(err) {
                    if (err) return callback(err);

                    addSatoshis(client, userId, amount, function(err) {
                        if (err) return callback(err);

                        callback(null);
                    });
                });
            });

        }, callback
    );
};

exports.addRawGiveaway = function(userNames, amount, callback) {
    assert(userNames && amount && callback);

    getClient(function(client, callback) {

        var tasks = userNames.map(function(username) {
            return function(callback) {

                client.query('SELECT id FROM users WHERE lower(username) = lower($1)', [username], function(err, result) {
                    if (err) return callback('unable to add bits');

                    if (result.rows.length === 0) return callback(username + ' didnt exists');

                    var userId = result.rows[0].id;
                    client.query('INSERT INTO giveaways(user_id, amount) VALUES($1, $2) ', [userId, amount], function(err, result) {
                        if (err) return callback(err);

                        assert(result.rowCount == 1);
                        addSatoshis(client, userId, amount, function(err) {
                            if (err) return callback(err);
                            callback(null);
                        });
                    });
                });
            };
        });

        async.series(tasks, function(err, ret) {
            if (err) return callback(err);
            return callback(null, ret);
        });

    }, callback);
};

exports.getUserNetProfit = function(userId, callback) {
    assert(userId);
    query('SELECT (' +
            'COALESCE(SUM(cash_out), 0) + ' +
            'COALESCE(SUM(bonus), 0) - ' +
            'COALESCE(SUM(bet), 0)) profit ' +
        'FROM plays ' +
        'WHERE user_id = $1', [userId], function(err, result) {
            if (err) return callback(err);
            assert(result.rows.length == 1);
            return callback(null, result.rows[0]);
        }
    );
};

exports.getUserNetProfitLast = function(userId, last, callback) {
    assert(userId);
    query('SELECT (' +
            'COALESCE(SUM(cash_out), 0) + ' +
            'COALESCE(SUM(bonus), 0) - ' +
            'COALESCE(SUM(bet), 0))::bigint profit ' +
            'FROM ( ' +
                'SELECT * FROM plays ' +
                'WHERE user_id = $1 ' +
                'ORDER BY id DESC ' +
                'LIMIT $2 ' +
            ') restricted ', [userId, last], function(err, result) {
            if (err) return callback(err);
            assert(result.rows.length == 1);
            return callback(null, result.rows[0].profit);
        }
    );
};

exports.getPublicStats = function(username, callback) {

  var sql = 'SELECT id AS user_id, username, gross_profit, net_profit, games_played, ' +
            'COALESCE((SELECT rank FROM leaderboard1 WHERE user_id = id), -1) rank1 ' +
            'FROM users WHERE lower(username) = lower($1)';

    query(sql,
        [username], function(err, result) {
            if (err) return callback(err);

            if (result.rows.length !== 1)
                return callback('USER_DOES_NOT_EXIST');

            return callback(null, result.rows[0]);
        }
    );
};

exports.makeWithdrawal = function(userId, satoshis, withdrawalAddress, withdrawalId, callback) {
    assert(typeof userId === 'number');
    assert(typeof satoshis === 'number');
    assert(typeof withdrawalAddress === 'string');
    assert(satoshis > 10000);
    assert(lib.isUUIDv4(withdrawalId));

    getClient(function(client, callback) {

        client.query("UPDATE users SET balance_satoshis = balance_satoshis - $1 WHERE id = $2",
            [satoshis, userId], function(err, response) {
            if (err) return callback(err);

            if (response.rowCount !== 1)
                return callback(new Error('Unexpected withdrawal row count: \n' + response));

            client.query('INSERT INTO fundings(user_id, amount, bitcoin_withdrawal_address, withdrawal_id) ' +
                "VALUES($1, $2, $3, $4) RETURNING id",
                [userId, -1 * satoshis, withdrawalAddress, withdrawalId],
                function(err, response) {
                    if (err) return callback(err);

                    var fundingId = response.rows[0].id;
                    assert(typeof fundingId === 'number');

                    callback(null, fundingId);
                }
            );
        });

    }, callback);
};

exports.getWithdrawals = function(userId, callback) {
    assert(userId && callback);

    query("SELECT * FROM fundings WHERE user_id = $1 AND amount < 0 ORDER BY created DESC", [userId], function(err, result) {
        if (err) return callback(err);

        var data = result.rows.map(function(row) {
           return {
               amount: Math.abs(row.amount),
               destination: row.bitcoin_withdrawal_address,
               status: row.bitcoin_withdrawal_txid,
               created: row.created
           };
        });
        callback(null, data);
    });
};

exports.getDeposits = function(userId, callback) {
    assert(userId && callback);

    query("SELECT * FROM fundings WHERE user_id = $1 AND amount > 0 ORDER BY created DESC", [userId], function(err, result) {
        if (err) return callback(err);

        var data = result.rows.map(function(row) {
            return {
                amount: row.amount,
                txid: row.bitcoin_deposit_txid,
                created: row.created
            };
        });
        callback(null, data);
    });
};
//add by lt

exports.getMoneyHistory = function(userId, limit, offset, callback) {
    assert(userId && callback);
	var total_history;
	var tcount;
	query("SELECT COUNT(*) total_count FROM money_charge WHERE user_id = $1 AND delisok = 0" ,[userId], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
	
		query("SELECT id, user_id, balance, pay_state, to_char(coalesce(end_datetime, request_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime, level FROM money_charge WHERE user_id = $1 AND delisok = 0 ORDER BY datetime DESC limit $2 OFFSET $3", [userId, limit, offset], function(err, result) {
			if (err) return callback(err);

			var data = result.rows.map(function(row) {
				var bal = Number(row.balance)*100;
				return {
					id: row.id,
					balance: lib.formatSatoshis(bal, 0),
					pay_state: row.pay_state,
					datetime: row.datetime,
					level: row.level,
					total_count : tcount
				};
			});
			callback(null, data);
		 });
	});
};
exports.getAccountInfo = function(callback) {
	var sql = "SELECT * FROM account where isok= '1'";
    query(sql, [], function(err, result) {
        if(err)
            return callback(err);
      //  assert(result.rowCount === 1);

        callback(null, result.rows[0]);
    });
};
exports.getRequestState = function(uid, callback) {
	var sql = "SELECT count(*) as cnt FROM money_charge WHERE pay_state='요청' and user_id = $1";
    query(sql, [uid], function(err, result) {
        if(err)
            return callback(err);
        callback(null, result.rows[0]);
    });
};
exports.getRequestState1 = function(uid, callback) {
	var sql = "SELECT count(*) as cnt FROM money_exchange WHERE pay_state='요청' and user_id = $1";
    query(sql, [uid], function(err, result) {
        if(err)
            return callback(err);
        callback(null, result.rows[0]);
    });
};
exports.getExAccountInfo = function(uid, callback) {
	var sql = "SELECT deposit_name, bankindex, accountnum FROM users where id= $1";
    query(sql, [uid], function(err, result) {
        if(err)
            return callback(err);
      //  assert(result.rowCount === 1);

        callback(null, result.rows[0]);
    });
};
exports.getMoneyExchangeHistory = function(userId, limit, offset, callback) {
    assert(userId && callback);
	var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM money_exchange WHERE user_id = $1 AND delisok = 0" ,[userId], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;

		query("SELECT id, user_id, balance, pay_state, to_char(coalesce(end_datetime, request_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime FROM money_exchange WHERE user_id = $1 AND delisok = 0 ORDER BY datetime DESC limit $2 OFFSET $3", [userId, limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				var bal = Number(row.balance)*100;
				return {
					id: row.id,
					balance: lib.formatSatoshis(bal, 0),
					pay_state: row.pay_state,
					datetime: row.datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};
exports.insertMoney = function(userId, Money, bank, owner, accountnum, callback) {
	query("select count(*) as cnt from money_charge where user_id = $1 and pay_state = $2", [userId, '요청'], function(err, results){
		if(err)  return callback(err);
		if(results.rows[0].cnt != 0) return callback('NOT_CONDITION');
		var sql = 'INSERT INTO money_charge (user_id, balance, pay_state, inbank, inowner, inaccountnum, level) values($1, $2, $3, $4, $5, $6, $7)';
		query(sql, [userId, Money, '요청', bank, owner, accountnum, 'money'], function(err, result) {
			if(err) return callback(err);
			callback(null, 'ok');
		});
	});
};
exports.insertMoneyExchange = function(userId, Money, bank, owner, accountnum, callback) {
	query("select count(*) as cnt from money_exchange where user_id = $1 and pay_state = $2", [userId, '요청'], function(err, results){
		if(err)  return callback(err);
		if(results.rows[0].cnt != 0) return callback('NOT_CONDITION');
		var bsql = "  select coalesce(sum(balance), 0) as balance "+
				   "  from money_charge " +
				   "  where user_id = $1 and pay_state = '승인' and "+
				   "  request_datetime < current_timestamp  and "+
				   "  request_datetime > (select coalesce(max(request_datetime), to_timestamp('05 Dec 2000', 'DD Mon YYYY')) from money_exchange where user_id = $1)" ;
		query(bsql, [userId], function(err, results){
			if(err)  return callback(err);
			var totalin = results.rows[0].balance;		
			 query("select * from exchange_environment", [], function(err, result){
				 if(err)  return callback(err);
				 var game_play;
				 var exchange_time;
				 if(result.rowCount != 1) {
					 game_play = 0;
					 exchange_time = 0;
				 }
				 else{
					 game_play = Number(result.rows[0].game_play);
					 exchange_time =  Number(result.rows[0].exchange_time);
				 }
				 var tsql = "  select coalesce(sum(bet), 0) as bet "+
						    "  from plays " +
						    "  where user_id = $1 and "+
						    "  created < current_timestamp  and "+
						    "  created > (select coalesce(max(request_datetime), to_timestamp('05 Dec 2000', 'DD Mon YYYY')) from money_exchange where user_id = $1)" ;
				 query(tsql, [userId], function(err, result){
					if(err)  return callback(err);
					var totalbet = result.rows[0].bet;
					var gamecnt = Math.floor(totalin*game_play);
					if(totalbet < gamecnt) return callback('NOT_ENOUGTH');
					query("select (extract(epoch from (current_timestamp - max(request_datetime))/3600))::integer as date from money_exchange where user_id=$1 and pay_state = $2", [userId, '승인'], function(err, result) {
						if(err)  return callback(err);
						var date;
						if(result.rows[0].date == null){
							date = 100;
						}
						else { 
							date = result.rows[0].date;
						}
						console.log(date);
						if(date < exchange_time) return callback('NOT_TIME');
						var sql = 'INSERT INTO money_exchange (user_id, balance, pay_state, outbank, outowner, outaccountnum) values($1, $2, $3, $4, $5, $6)';
						query(sql, [userId, Money, '요청', bank, owner, accountnum], function(err, result) {
							if(err)  return callback(err);

							assert(result.rowCount === 1);
							query('UPDATE users SET balance_satoshis  = balance_satoshis - $1 WHERE id = $2', [Money*100, userId], function(err, result) {
								if(err)
									return callback(err);
								assert(result.rowCount === 1);
								callback(null, 'ok');
							});
						});
					});
				 });
			 });
		});
	});
};
exports.historyDelete = function(dataIndex, callback) {
	var sql = 'UPDATE money_charge SET delisok = 1 WHERE id= $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
            return callback(err);
        assert(result.rowCount === 1);

        callback(null);
    });
};
exports.historyExchangeDelete = function(dataIndex, callback) {
	var sql = 'UPDATE money_exchange SET delisok = 1 WHERE id= $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
            return callback(err);
        assert(result.rowCount === 1);

        callback(null);
    });
};

exports.getnoticeList = function(limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM notice", function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
	
		query("SELECT uid, subject, to_char(write_datetime, 'YYYY-MM-DD HH24:MI:SS') as write_datetime FROM notice ORDER BY write_datetime DESC limit $1 OFFSET $2", [limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					uid: row.uid,
					subject: row.subject,
					write_datetime: row.write_datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};

exports.getnoticeRead = function(idx, callback) {
	var content;
    query("SELECT subject,content FROM notice WHERE uid = $1", [idx], function(err, result) {
        if (err) return callback(err);
		
		callback(null, result.rows[0]);
    });
};

exports.getmemoList = function(userId,limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM memo WHERE user_id = $1", [userId], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;

		query("SELECT uid, subject, confirm_datetime, to_char(write_datetime, 'YYYY-MM-DD HH24:MI:SS') as write_datetime, to_char(coalesce(confirm_datetime, write_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime" + 
			 " FROM memo" + 
			 " WHERE user_id = $1" +
			 " ORDER BY datetime DESC limit $2 OFFSET $3", [userId, limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					uid: row.uid,
					subject: row.subject,
					confirm_datetime: row.confirm_datetime,
					write_datetime: row.write_datetime,
					datetime: row.datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};

exports.getmemoRead = function(idx, callback) {
	
	query('UPDATE memo SET confirm_datetime = now() WHERE uid = $1', [idx], function(err, res) {
		if(err) return callback(err);

		query("SELECT uid, subject, content, to_char(coalesce(confirm_datetime, write_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime  FROM memo WHERE uid = $1", [idx], function(err, result) {
			if (err) return callback(err);
			
			callback(null, result.rows[0]);
		});
	});
};
exports.getmemoNext = function(idx, uid, callback) {
	var content;
    query("SELECT uid, subject, content, to_char(coalesce(confirm_datetime, write_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime FROM memo WHERE uid = (SELECT MIN(uid) FROM memo WHERE uid > $1) and user_id = $2", [idx, uid], function(err, result) {
        if (err) return callback(err);
		if(result.rowCount === 1) {
			var data ={
				uid: result.rows[0].uid,
				datetime: result.rows[0].uid.datetime,
				content: result.rows[0].content,
				subject: result.rows[0].subject
			}
			callback(null, data);
		}
		else{
			var data ={
				uid: idx,
				datetime: '',
				content: '아랫글이 없습니다.',
				subject: ''
			}
			callback(null, data);
		}
    });
};
exports.getmemoPrev = function(idx, uid, callback) {
	var content;
    query("SELECT uid, subject, content, to_char(coalesce(confirm_datetime, write_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime FROM memo WHERE uid = (SELECT MIN(uid) FROM memo WHERE uid < $1) and user_id=$2", [idx, uid], function(err, result) {
        if (err) return callback(err);
		if(result.rowCount === 1) {
			var data ={
				uid: result.rows[0].uid,
				datetime: result.rows[0].uid.datetime,
				content: result.rows[0].content,
				subject: result.rows[0].subject
			}
			callback(null, data);
		}
		else{
			var data ={
				uid: idx,
				datetime: '',
				content: '윗글이 없습니다.',
				subject: ''
			}
			callback(null, data);
		}
    });
};
exports.memoDelete = function(dataIndex, callback) {
	var sql = 'Delete from memo where uid= $1';
	query(sql, [dataIndex], function(err, result) {
        if(err)
            return callback(err);
       // assert(result.rowCount === 1);

        callback(null);
    });
};
exports.getqnaList = function(userId,limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM inquiry", function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
	
		query("select no, rno, subject, to_char(request_datetime, 'YYYY-MM-DD HH24:MI:SS') as request_datetime, to_char(confirm_datetime, 'YYYY-MM-DD HH24:MI:SS') as confirm_datetime, to_char(reply_datetime, 'YYYY-MM-DD HH24:MI:SS') as reply_datetime, to_char(coalesce(reply_datetime, datetime1), 'YYYY-MM-DD HH24:MI:SS') as datetime " +
			  "from(" +
					"SELECT inquiry.no as no, reply.no as rno, inquiry.subject as subject, request_datetime, confirm_datetime, reply_datetime, coalesce(confirm_datetime, request_datetime) as datetime1 " + 
					"FROM   inquiry LEFT JOIN reply ON inquiry.no =  reply.inquiry_no " +
					"WHERE user_no = $1"+ 
			  ") a "+ 
			  "ORDER BY datetime DESC limit $2 OFFSET $3", [userId, limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					no: row.no,
					rno: row.rno,
					subject: row.subject,
					request_datetime: row.request_datetime,
					reply_datetime: row.reply_datetime,
					confirm_datetime: row.confirm_datetime,
					datetime: row.datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};
exports.getqnaRead = function(idx, rno, update_flag, callback) {
	if(update_flag == 'true'){
		query('update inquiry SET confirm_datetime = now() where no = $1', [idx], function(err, result) {
			if(err)
				return callback(err);
		});
	}
	if(rno) {
		query('update reply SET confirm_reply_datetime = now() where no = $1', [rno], function(err, result) {
			if(err)
				return callback(err);
		});
	}
   query("select no, reply_no, inquiry_subject, inquiry_contents, reply_subject, reply_contents, to_char(coalesce(reply_datetime, datetime1), 'YYYY-MM-DD HH24:MI:SS') as datetime" +
		" from (" +
			 " SELECT inquiry.no as no,inquiry.subject as inquiry_subject, inquiry.contents as inquiry_contents, reply.no as reply_no, reply.subject as reply_subject, reply.contents as reply_contents,reply_datetime, coalesce(confirm_datetime, request_datetime) as datetime1" +
             " FROM inquiry LEFT JOIN reply ON inquiry.no =  reply.inquiry_no" + 
			 " WHERE inquiry.no = $1" +
			 " ) a" +
		" ORDER BY datetime DESC", [idx], function(err, result) {
        if (err) return callback(err);
		callback(null, result.rows[0]);
    });
};
exports.qnaDelete = function(dataIndex, callback) {
	query("Delete from inquiry where no = $1 ",[dataIndex], function(err, total){
		if(err) return callback(err);
	});

	var sql = 'Delete from reply where inquiry_no= $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
            return callback(err);

        callback(null);
    });
};
exports.qnaInsert = function(userId, subject, contents, callback) {
	var sql = 'INSERT INTO inquiry (user_no, subject, contents) values($1, $2, $3)';
    query(sql, [userId, subject, contents], function(err, result) {
        if(err)
            return callback(err);
        assert(result.rowCount === 1);

        callback(null);
    });
};
exports.getDepositsAmount = function(userId, callback) {
    assert(userId);
    query('SELECT SUM(f.amount) FROM fundings f WHERE user_id = $1 AND amount >= 0', [userId], function(err, result) {
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};

exports.getWithdrawalsAmount = function(userId, callback) {
    assert(userId);
    query('SELECT SUM(f.amount) FROM fundings f WHERE user_id = $1 AND amount < 0', [userId], function(err, result) {
        if (err) return callback(err);

        callback(null, result.rows[0]);
    });
};

exports.setFundingsWithdrawalTxid = function(fundingId, txid, callback) {
    assert(typeof fundingId === 'number');
    assert(typeof txid === 'string');
    assert(callback);

    query('UPDATE fundings SET bitcoin_withdrawal_txid = $1 WHERE id = $2', [txid, fundingId],
        function(err, result) {
           if (err) return callback(err);

            assert(result.rowCount === 1);

            callback(null);
        }
    );
};


exports.getLeaderBoard = function(byDb, order, callback) {
    var sql = 'SELECT * FROM leaderboard1 WHERE rank <=50 ORDER BY ' + byDb + ' ' + order;
    query(sql, function(err, data) {
        if (err)
            return callback(err);
        callback(null, data.rows);
    });
};

// Added by jjb 2017.10.24.
exports.removeMsg = function(msgid, callback){
    var sql = "DELETE FROM chat_messages WHERE id=$1";
    query(sql, [msgid], function (err, results) {
        if(err) return callback(err);
        console.log('Removed message in db: ', msgid);
        callback(null);
    });
};
// End

exports.addChatMessage = function(userId, created, message, channelName, isBot, callback) {

    var sql = 'INSERT INTO chat_messages (user_id, created, message, channel, is_bot) values($1, $2, $3, $4, $5) RETURNING id';
    query(sql, [userId, created, message, channelName, isBot], function(err, res) {
        if(err)
            return callback(err, null);

        assert(res.rowCount === 1);
        var msgid = res.rows[0].id;
        callback(null, msgid);
    });
};
//add by lt
/*
exports.getVirUser = function(callback) {
    var sql = "SELECT * FROM users_view WHERE userclass = $1 ORDER BY username ";
    query(sql, ['v_user'], function(err, data) {
        if(err)
            return callback(err);
        callback(null, data.rows);
    });
};
*/
exports.getChatTable = function(limit, channelName, callback) {
    assert(typeof limit === 'number');
    /*var sql = "SELECT chat_messages.created AS date, 'say' AS type, users.username, users.userclass AS role, chat_messages.message, is_bot AS bot " +
        "FROM chat_messages JOIN users ON users.id = chat_messages.user_id WHERE channel = $1 ORDER BY chat_messages.id DESC LIMIT $2";*/
		/*var sql = "SELECT chat_messages.created  AS date, 'say' AS type, " + 
					 "users.username, users.userclass AS role, chat_messages.message, is_bot AS bot, 'count' AS count, " +
					 "(SELECT to_json(array_agg(to_json(pv))) " +
					  "FROM (SELECT id, username " +
	   						"FROM users WHERE userclass != 'user' order by username) pv) as vuser " +
			  "FROM chat_messages JOIN users ON users.id = chat_messages.user_id WHERE channel = $1 ORDER BY chat_messages.id DESC LIMIT $2";*/
		var sql = "SELECT * " +
				  "FROM       (SELECT  chat_messages.id, chat_messages.created  AS date, 'say' as type, users.username, users.userclass AS role, users.chatisok, "+
				  "                    chat_messages.message, is_bot AS bot, 'count' AS count, "+
				  "					   (SELECT     to_json(array_agg(to_json(pv))) "+
				  "	                    FROM       (SELECT     id, username "+
	   		      "                                 FROM       users WHERE userclass != 'user' order by username) pv) as vuser "+
                  "            FROM chat_messages join users ON users.id = chat_messages.user_id "+
				  "			   UNION ALL "+
				  "            SELECT	0 as id, now() as date, 'say' as type, '' as username, 'v_user' as role, 1 as chatisok,  ' ' as message, false as bot, 'count' as count, "+ 
				  "					    (SELECT     to_json(array_agg(to_json(pv))) "+
				  "                      FROM       (SELECT    id, username "+
	   		      "                                  FROM      users WHERE userclass = 'v_user' or userclass = 'admin'  order by username) pv) as vuser) a "+
				  "ORDER BY id DESC "+
				  "LIMIT $1 ";
		query(sql, [limit], function(err, data) {
        if(err)
            return callback(err);
		data.rows.forEach(function(row) {
            // oldInfo is like: [{"username":"USER","bet":satoshis, ,..}, ..]
            var oldInfo = row.vuser || [];
            var newInfo = row.vuser = {};
			var i = 0;
            oldInfo.forEach(function(virUser) {
				
                newInfo[i] = {
					id : virUser.id ,
                    username: virUser.username
                };
				i++;
            });
			row.count  = i;
        });

        callback(null, data.rows);
    });
};

//Get the history of the chat of all channels except the mods channel
exports.getAllChatTable = function(limit, callback) {
    assert(typeof limit === 'number');
    var sql = m(function(){/*
     SELECT chat_messages.created AS date, 'say' AS type, users.username, users.userclass AS role, chat_messages.message, is_bot AS bot, chat_messages.channel AS "channelName"
     FROM chat_messages JOIN users ON users.id = chat_messages.user_id WHERE channel <> 'moderators'  ORDER BY chat_messages.id DESC LIMIT $1
    */});
    query(sql, [limit], function(err, data) {
        if(err)
            return callback(err);
        callback(null, data.rows);
    });
};

exports.getSiteStats = function(callback) {

    function as(name, callback) {
        return function(err, results) {
            if (err)
                return callback(err);

            assert(results.rows.length === 1);
            callback(null, [name, results.rows[0]]);
        }
    }

    var tasks = [
        function(callback) {
            query('SELECT COUNT(*) FROM users', as('users', callback));
        },
        function (callback) {
            query('SELECT COUNT(*) FROM games', as('games', callback));
        },
        function(callback) {
            query('SELECT COALESCE(SUM(fundings.amount), 0)::bigint sum FROM fundings WHERE amount < 0', as('withdrawals', callback));
        },
        function(callback) {
            query("SELECT COUNT(*) FROM games WHERE ended = false AND created < NOW() - interval '5 minutes'", as('unterminated_games', callback));
        },
        function(callback) {
            query('SELECT COUNT(*) FROM fundings WHERE amount < 0 AND bitcoin_withdrawal_txid IS NULL', as('pending_withdrawals', callback));
        },
        function(callback) {
            query('SELECT COALESCE(SUM(fundings.amount), 0)::bigint sum FROM fundings WHERE amount > 0', as('deposits', callback));
        },
        function(callback) {
            query('SELECT ' +
                'COUNT(*) count, ' +
                'SUM(plays.bet)::bigint total_bet, ' +
                'SUM(plays.cash_out)::bigint cashed_out, ' +
                'SUM(plays.bonus)::bigint bonused ' +
                'FROM plays', as('plays', callback));
        }
    ];

    async.series(tasks, function(err, results) {
       if (err) return callback(err);

       var data = {};

        results.forEach(function(entry) {
           data[entry[0]] = entry[1];
        });

        callback(null, data);
    });

};


//add by lt admin

exports.getSearchCharge = function(uid, uclass, solecode, username, pay_state, limit, offset, callback) {
	var total_history;
	var tcount;
	var	sql1 = " SELECT COUNT(*) total_count, SUM(balance) as totalin" +
			  " FROM money_charge Left JOIN users ON money_charge.user_id = users.id" +
			  "	WHERE true and money_charge.level = 'money'";
	var sql2 = "";
	if(uclass == 'distributor') sql2 += " and pay_state = '승인' and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(uclass == 'partner') sql2 +=" and pay_state = '승인' and solecodeinput = '"+ solecode +"'";
	if(username)		sql2 += " and users.username like '%" +username + "%'";
    if(pay_state)		sql2 += " and pay_state = '" + pay_state + "'";
	var sql = sql1 + sql2;
	var sql3 = "";
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
		var totalin = total_history.totalin;
		sql1 = "SELECT money_charge.id as id, pay_state, users.bankindex as inbank, users.deposit_name as inowner, users.accountnum as inaccountnum, users.id as user_id, username, balance, to_char(request_datetime, 'YYYY-MM-DD HH24:MI:SS') as request_datetime, to_char(end_datetime, 'YYYY-MM-DD HH24:MI:SS') as end_datetime " + 
			   "FROM money_charge LEFT JOIN users ON money_charge.user_id = users.id WHERE true and money_charge.level = 'money'";

		sql3 = " ORDER BY request_datetime DESC LIMIT $1 OFFSET $2";

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
		    if (err) return callback(err);

			var data = result.rows.map(function(row) {
				var balance1 = row.balance;
				return {
					id: row.id,
					user_id: row.user_id,
					username: row.username,
					bank: row.inbank,
					owner: row.inowner,
					accountnum: row.inaccountnum,
					balance: lib.formatSatoshis(balance1*100, 0),
					pay_state: row.pay_state,
					request_datetime: row.request_datetime,
					end_datetime: row.end_datetime,
					total_count : tcount,
					totalin: lib.formatSatoshis(totalin*100, 0)
				};
			});
			callback(null, data);
		 });
	});
};
exports.approvalCharge = function(moneyId, callback) {
    assert(moneyId);
    query('SELECT user_id, balance FROM money_charge WHERE id = $1', [moneyId] , function(err, result) {
        if (err) return callback(err);
        assert(result.rowCount === 1);
        var user_id = result.rows[0].user_id;
        var amount = Number(result.rows[0].balance);
        query('SELECT logcnt FROM users WHERE id = $1', [user_id], function(err, results) {
            if(err) return callback(err);
            assert(results.rowCount === 1);
            var logcnt = Number(results.rows[0].logcnt);
            // Modified by jjb 2017.10.27. Added " AND pay_state = $2"
            query('SELECT  count(*) AS cnt1 FROM money_charge WHERE user_id = $1 AND pay_state = $2', [user_id, '승인'], function(err, results) {

                if(err) return callback(err);
                //assert(results.rows.length === 1);
                var cnt1 = Number(results.rows[0].cnt1);
                query('SELECT count(*) AS cnt FROM money_charge WHERE date(end_datetime) = CURRENT_DATE AND user_id = $1 AND pay_state = $2', [user_id, '승인'], function(err, result) {

                    if(err) return callback(err);
                    var cnt = Number(result.rows[0].cnt);
                    query('SELECT * FROM bonus_environment', [], function(err, results) {

                        if(err) return callback(err);
                        var join_first;
                        var real_first;
                        var real_charge;
                        if(results.rowCount != 1) {
                            join_first = 0;
                            real_first = 0;
                            real_charge = 0;
                        }else {
                            join_first = lib.removeNullsAndTrim(results.rows[0].join_first);
                            real_first = lib.removeNullsAndTrim(results.rows[0].real_first);
                            real_charge = lib.removeNullsAndTrim(results.rows[0].real_charge);
                        }
                        var point = 0;
                        /* Commented by jjb 2017.10.25.
                        if(logcnt == 1 && cnt == 0) point = Math.floor(amount*join_first/100);
                        else if(logcnt !=1 && cnt1 == 0) point = Math.floor(amount*join_first/100);
                        else if(logcnt !=1 && cnt == 0)	point = Math.floor(amount*real_first/100);
                        else point = Math.floor(amount*real_charge/100);
                        */
                        // Added by jjb 2017.10.27.
                        if(cnt1 == 0) point = Math.floor(amount*join_first/100);
                        else if(logcnt !=1 && cnt == 0)	point = Math.floor(amount*real_first/100);
                        else point = Math.floor(amount*real_charge/100);
                        // End
                        query('UPDATE money_charge SET pay_state = $1,  end_datetime = now() WHERE id = $2', ['승인',moneyId], function(err, res) {

                            if(err) return callback(err);
                            // assert(res.rows.length === 1);

                            exports.inMoneySettlement(user_id, amount); // Added by jjb 2017.10.27.

                            var sql = 'INSERT INTO money_charge (user_id, balance, pay_state,  level, end_datetime) values($1, $2, $3, $4, now())';
                            query(sql, [user_id, point, '승인', 'point'], function(err, result1) {

                                if(err) return callback(err);
                                query('UPDATE users SET balance_satoshis = balance_satoshis + $1, point = point + $2 WHERE id = $3', [amount*100,  point*100, user_id], function(err, res) {
                                    console.log('8');
                                    if (err) return callback(err);
                                    callback(null);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};
// Added by jjb 2017.10.27.
exports.inMoneySettlement = function(user_id, money){
    var sql = 'SELECT p.partner_code, p.jibun FROM users LEFT JOIN partner AS p ON users.solecodeinput = p.partner_code WHERE users.id = $1';
    query(sql, [user_id], function(err, result){
        if(err) console.error('[SQL Error]: ', err);
        if(result.rowCount == 0 || !result.rows[0].partner_code) console.log('[Error] ', 'Cannot find the partner of user_id = ', user_id);

        var partner_code    = result.rows[0].partner_code;
        var jibun           = result.rows[0].jibun;

        var sql = 'INSERT INTO settlement (datetime, inmoney, outmoney, solecode, jibun) VALUES (now(), $1, $2, $3, $4)';
        query(sql, [money, 0, partner_code, jibun], function (err, result) {
            if(err) consol.log('[SQL Error]: ',  err);
        });
    });
};
exports.outMoneySettlement = function(user_id, money){
    var sql = 'SELECT p.partner_code, p.jibun FROM users LEFT JOIN partner AS p ON users.solecodeinput = p.partner_code WHERE users.id = $1';
    query(sql, [user_id], function(err, result){
        if(err) console.error('[SQL Error]: ', err);
        if(result.rowCount == 0 || !result.rows[0].partner_code) console.log('[Error] ', 'Cannot find the partner of user_id = ', user_id);

        var partner_code    = result.rows[0].partner_code;
        var jibun           = result.rows[0].jibun;

        var sql = 'INSERT INTO settlement (datetime, inmoney, outmoney, solecode, jibun) VALUES (now(), $1, $2, $3, $4)';
        query(sql, [0, money, partner_code, jibun], function (err, result) {
            if(err) consol.log('[SQL Error]: ',  err);
        });
    });
};
exports.getIOMoney = function(from_date, to_date, userclass, partner_code, callback){
    var solecode = partner_code;
    var sql     = "";
    var select  = "";
    var from    = " FROM settlement";
    var where   = "";
    var groupby = " GROUP BY datetime, jibun";
    if(userclass == 'admin'){
        //sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE $1 < date(datetime) AND date(datetime) <= $2";
        select = "SELECT SUM(inmoney) AS inmoney, SUM(outmoney) AS outmoney, to_char(datetime, 'YYYY-MM-DD') AS datetime, jibun";
        where = " WHERE $1 < date(datetime) AND date(datetime) <= $2";
        sql = select + from + where + groupby;
        query(sql, [from_date, to_date], function(err, result){
            if(err) callback(err);
            callback(null, result);
        });
    }
    if(userclass == 'distributor'){
        //sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE solecode=$1 AND $1 < date(datetime) AND date(datetime) <= $2";
        select = "SELECT SUM(inmoney) AS inmoney, SUM(outmoney) AS outmoney, to_char(datetime, 'YYYY-MM-DD') AS datetime, jibun";
        where = " WHERE solecode IN (SELECT partner_code FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1)) AND $2 < date(datetime) AND date(datetime) <= $3";
        sql = select + from + where + groupby;
        query(sql, [solecode, from_date, to_date], function(err, result){
            if(err) callback(err);
            callback(null, result);
        });
    }
    if(userclass == 'partner'){
        //sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE solecode=$1 AND $1 < date(datetime) AND date(datetime) <= $2";
        select = "SELECT SUM(inmoney) AS inmoney, SUM(outmoney) AS outmoney, to_char(datetime, 'YYYY-MM-DD') AS datetime, jibun";
        where = " WHERE solecode=$1 AND $2 < date(datetime) AND date(datetime) <= $3";
        sql = select + from + where + groupby;
        query(sql, [solecode, from_date, to_date], function(err, result){
            if(err) callback(err);
            callback(null, result);
        });
    }
};
exports.getSettlementDate = function(callback){
    var sql = "SELECT * FROM settlement_finish";
    query(sql, [], function(err, result){
        if(err) callback(err);
        callback(null, result);
    });
};
// End
exports.deferCharge = function(moneyId, callback) {
    assert(moneyId);

    query('UPDATE money_charge SET pay_state = $1, end_datetime = now() WHERE id = $2', ['보류',moneyId], function(err, res) {
        if(err) return callback(err);

        assert(res.rowCount === 1);
        callback(null);
    });
};
exports.refuseCharge = function(moneyId, callback) {
    assert(moneyId);

    query('UPDATE money_charge SET pay_state = $1,  end_datetime = now() WHERE id = $2', ['거부',moneyId], function(err, res) {
        if(err) return callback(err);

        assert(res.rowCount === 1);
        callback(null);
    });
};
//Exchange
exports.getSearchExchange = function(uid, uclass, solecode, username, pay_state, limit, offset, callback) {
	var total_history;
	var tcount;
	var	sql1 = " SELECT COUNT(*) total_count,  COALESCE(SUM(balance), 0) as totalout" +
			  " FROM money_exchange Left JOIN users ON money_exchange.user_id = users.id" +
			  "	WHERE true";
	var sql2 = "";
	if(uclass == 'distributor') sql2 += " and pay_state = '승인' and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(uclass == 'partner') sql2 +=" and pay_state = '승인' and solecodeinput = '"+ solecode +"'";
	if(username)		sql2 += " and users.username like '%" +username + "%'";
    if(pay_state)		sql2 += " and pay_state = '" + pay_state + "'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;	
		var totalout = total_history.totalout;
		sql1 = "SELECT money_exchange.id as id, pay_state, users.id as user_id, username, outbank, outaccountnum, outowner, balance, to_char(request_datetime, 'YYYY-MM-DD HH24:MI:SS') as request_datetime, to_char(end_datetime, 'YYYY-MM-DD HH24:MI:SS') as end_datetime FROM money_exchange LEFT JOIN users ON money_exchange.user_id = users.id WHERE true";

		sql3 = " ORDER BY request_datetime DESC LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);

			var data = result.rows.map(function(row) {
				var balance1 = row.balance;
				return {
					id: row.id,
					user_id: row.user_id,
					username: row.username,
					deposit_name: row.outowner,
					accountnum: row.outaccountnum,
					bankindex: row.outbank,
					balance: lib.formatSatoshis(balance1*100, 0),
					pay_state: row.pay_state,
					request_datetime: row.request_datetime,
					end_datetime: row.end_datetime,
					total_count : tcount,
					totalout: lib.formatSatoshis(totalout*100, 0)
				};
			});
			callback(null, data);
		 });
	});
};
exports.approvalExchange = function(moneyId, callback) {
    assert(moneyId);
	query('UPDATE money_exchange SET pay_state = $1,  end_datetime = now() WHERE id = $2', ['승인',moneyId], function(err, res) {
		if(err) return callback(err);
		var sql = 'SELECT user_id, balance FROM money_exchange WHERE id = $1';
        query(sql, [moneyId] , function(err, result) {
            if(err) console.log('[SQL Error] ', err);
            var amount = result.rows[0].balance;
            var user_id = result.rows[0].user_id;
            exports.outMoneySettlement(user_id, amount);
        });
		callback(null);
	});
};
exports.deferExchange = function(moneyId, callback) {
    assert(moneyId);
	query('UPDATE money_exchange SET pay_state = $1,  end_datetime = now() WHERE id = $2', ['보류',moneyId], function(err, res) {
		if(err) return callback(err);
		callback(null);
	});
};
exports.refuseExchange = function(moneyId, callback) {
    assert(moneyId);

	query('SELECT user_id, balance, pay_state FROM money_exchange WHERE id = $1', [moneyId] , function(err, result) {
    if (err) return callback(err);
	    var user_id = result.rows[0].user_id;
		var amount = Number(result.rows[0].balance)*100;
		var state = result.rows[0].pay_state;
		query('UPDATE money_exchange SET pay_state = $1,  end_datetime = now() WHERE id = $2', ['거부',moneyId], function(err, res) {
			if(err) return callback(err);
			query('UPDATE users SET balance_satoshis = balance_satoshis + $1 WHERE id = $2', [amount, user_id], function(err, res) {
				if (err) return callback(err);
				callback(null);
			});
		});
    });
};
//notice
exports.adminNoticeInsert = function(uid, subject, content, state, callback) {
	if(state == '등록'){
		query('INSERT INTO notice (subject, content) values($1, $2)', [subject, content], function(err, result) {
			if(err)
				return callback(err);
			assert(result.rowCount === 1);

			callback(null);
		});
	}
	else{
		query('UPDATE notice SET subject = $1, content = $2, write_datetime = now() WHERE uid = $3', [subject, content, uid], function(err, result) {
			if(err)
				return callback(err);
			assert(result.rowCount === 1);

			callback(null);
		});
	}
};
exports.getNoticeInfo = function(idx, callback) {

    query("SELECT uid, subject, content, to_char(write_datetime, 'YYYY-MM-DD HH24:MI:SS') as write_datetime FROM notice WHERE uid = $1", [idx], function(err, result) {
        if (err) return callback(err);
		
		callback(null, result.rows[0]);
    });
};
exports.adminNoticeDelete = function(uid, callback) {
	query('Delete from notice where uid= $1', [uid], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};

//qna
exports.getuserList = function(callback) {

    query("SELECT id, username FROM users WHERE userclass = 'user' ORDER BY id", function(err, result) {
        if (err) return callback(err);
		
		var data = result.rows.map(function(row) {
				return {
					id: row.id,
					username: row.username
				};
			});
		callback(null, data);
    });
};
exports.getSearchQna = function(username, limit, offset, callback) {
	var total_history;
	var tcount;
	var	sql1 = " SELECT COUNT(*) total_count" +
			  " FROM inquiry LEFT JOIN users On inquiry.user_no = users.id" +
			  "	WHERE true";
	var sql2 = "";
	if(username)		sql2 += " and users.username like '%" +username + "%'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;		
		sql1 = "SELECT inquiry.no as no, reply.no as reply_no, username, to_char(request_datetime, 'YYYY-MM-DD HH24:MI:SS') as request_datetime, inquiry.subject as subject, to_char(confirm_datetime, 'YYYY-MM-DD HH24:MI:SS') as confirm_datetime, to_char(reply_datetime, 'YYYY-MM-DD HH24:MI:SS') as reply_datetime FROM inquiry LEFT JOIN users ON inquiry.user_no = users.id LEFT JOIN reply ON inquiry.no = reply.inquiry_no WHERE true";

		sql3 = " ORDER BY request_datetime DESC LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					no: row.no,
					reply_no: row.reply_no,
					username: row.username,
					request_datetime: row.request_datetime,
					subject: row.subject,
					confirm_datetime: row.confirm_datetime,
					reply_datetime: row.reply_datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		 });
	});
};
exports.insertReply = function(inquiry_no, reply_no, reply_subject, reply_content, callback) {
	query("Delete from reply where no= $1", [reply_no], function(err, total){
		if(err) return callback(err);
		query("INSERT INTO reply(inquiry_no, subject, contents, reply_datetime) VALUES($1, $2, $3, now())", [inquiry_no, reply_subject, reply_content], function(err, result) {
			if (err) return callback(err);
			assert(result.rowCount === 1);

			callback(null);
		});
	});
};
exports.qnaDelete = function(uid, callback) {
	query('Delete from inquiry where no = $1', [uid], function(err, result) {
		if(err)	return callback(err);
		query('Delete from reply where inquiry_no = $1', [uid], function(err, result) {
			if (err) return callback(err);
			//assert(result.rowCount === 1);

			callback(null);
		});
	});
};

//Memo
exports.getSearchMemo = function(username, limit, offset, callback) {
	var total_history;
	var tcount;
	var	sql1 = " SELECT COUNT(*) total_count" +
			  " FROM memo JOIN users ON users.id = memo.user_id" +
			  "	WHERE true";
	var sql2 = "";
	if(username)		sql2 += " and users.username like '%" +username + "%'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;		
		sql1 = "SELECT memo.uid as uid, subject, to_char(write_datetime, 'YYYY-MM-DD HH24:MI:SS') as write_datetime, username, to_char(confirm_datetime, 'YYYY-MM-DD HH24:MI:SS') as confirm_datetime FROM memo LEFT JOIN users ON memo.user_id = users.id  WHERE true";

		sql3 = " ORDER BY write_datetime DESC LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);

			var data = result.rows.map(function(row) {
				return {
					uid: row.uid,
					username: row.username,
					write_datetime: row.write_datetime,
					subject: row.subject,
					confirm_datetime: row.confirm_datetime,
					total_count : tcount
				};
			});
			callback(null, data);
		 });
	});
};
exports.memoDelete = function(uid, callback) {
	console.log(uid);
	query('Delete from memo where uid = $1', [uid], function(err, result) {
		if (err) return callback(err);
		//assert(result.rowCount === 1);

		callback(null);
	});
};
exports.adminMemoInsert = function(uid, subject, content, state, username, callback) {
	if(state == '등록'){
		query('INSERT INTO memo (subject, content, user_id) values($1, $2, $3)', [subject, content, username], function(err, result) {
			if(err)
				return callback(err);
			assert(result.rowCount === 1);

			callback(null);
		});
	}
	else{
		query('UPDATE memo SET subject = $1, content = $2, user_id = $3, write_datetime = now() WHERE uid = $4', [subject, content, username, uid], function(err, result) {
			if(err)
				return callback(err);
			assert(result.rowCount === 1);

			callback(null);
		});
	}
};
// Added by jjb 2017.10.23.
exports.adminMemoInsertAll = function(subject, content, state, callback){
    var sql = "SELECT id FROM users WHERE userclass != 'admin' AND userclass != 'v_user'";
    if(state == '등록'){
        query(sql, function(err, result){
            var data = result.rows.map(function(row) {
                var sql = '';
                sql = "INSERT INTO memo (subject, content, user_id) VALUES('"+subject+"', '"+ content +"', " + row.id + ");";
                query(sql, function(err, result){
                    if(err) return callback(err);
                });
                return sql; 
            });
        });
        callback(null);
    }
};
// End
exports.getMemoInfo = function(idx, callback) {

    query("SELECT uid, subject, content, to_char(write_datetime, 'YYYY-MM-DD HH24:MI:SS') as write_datetime, user_id FROM memo WHERE uid = $1", [idx], function(err, result) {
        if (err) return callback(err);
		
		callback(null, result.rows[0]);
    });
};
exports.getUserAndMessage = function(vId, cId, callback) {
	/*var maxUser = Number('30');
	var minUser = Number('18');
	var RandUser = Math.random() * (maxUser - minUser) + minUser;
	RandUser =  Math.floor(RandUser);
	var RandChat = Math.random() * (5 - 1) + 1;
	RandChat =  Math.floor(RandChat);
	var user_id;
	var username;
	console.log('RandUser=', RandUser);
	console.log('RandChat=', RandChat);*/

	query('SELECT username, users.id as userid, content FROM vir_chat, users WHERE vir_chat.id = $1 and users.id = $2', [cId, vId], function(err, res) {
		if(err) return callback(err);
		assert(res.rowCount === 1) 
		callback(null, res.rows[0]);
	});
};
exports.vIdList = function(callback) {
	query("SELECT id FROM users WHERE userclass = $1", ['v_user'], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.vChatIdList = function(callback) {
	query("SELECT id FROM vir_chat", function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};

exports.getvUserList = function(username, limit, offset, callback) {
    var total_history;
	var tcount = 0;
	var sql1 = '';
	if(username) sql1= " and username like '%"+username+"%'";
	var sql = "SELECT COUNT(*) total_count FROM users WHERE userclass = $1 and true ";
	sql = sql + sql1;
	query(sql, ['v_user'], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
		sql = "SELECT id, username, balance_satoshis, virbetsize, COALESCE(virbetval, 0) as virbetval, betisok FROM users WHERE userclass = $1 and true ";
		var sql2 = " ORDER BY created DESC limit $2 OFFSET $3";
		sql = sql + sql1 + sql2;
		query(sql, ['v_user', limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				var bal = row.virbetval;
				return {
					id: row.id,
					username: row.username,
					balance_satoshis: row.balance_satoshis,
					virbetsize: row.virbetsize,
					virbetval: bal/100,
					betIsOk: row.betisok,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};
/*
exports.vUserSearchByName = function(username, limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM users WHERE userclass = 'v_user' and username like '%"+username+"%'", [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
	
		query("SELECT id, username, balance_satoshis, virbetsize, COALESCE(virbetval, 0) as virbetval, betisok FROM users WHERE userclass = 'v_user' and username like '%"+username+"%'  ORDER BY created DESC limit $1 OFFSET $2", [limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				var bal = row.virbetval;
				return {
					id: row.id,
					username: row.username,
					balance_satoshis: lib.formatSatoshis(row.balance_satoshis, 0),
					virbetsize: lib.formatSatoshis(row.virbetsize, 0),
					virbetval: bal/100,
					betIsOk: row.betisok,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};*/
exports.adminvUserInsert = function(username, password, balance_satoshis, phone, callback) {
	//var hashedPassword = passwordHash.generate(password);
	var balance = Number(balance_satoshis)*100;
    // Modified by jjb 2017.10.21. Added playisok field!
	query('INSERT INTO users (username, password, balance_satoshis, phone, userclass, playisok) values($1, $2, $3, $4, $5, $6)', [username, password, balance, phone, 'v_user', 1], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};
exports.adminvUserDelete = function(uid, callback) {
	query('Delete from users where id= $1', [uid], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};
exports.vUserBetCancel = function(dataIndex, callback) {
	query('select betisok from users where id = $1', [dataIndex], function(err, res){
		if(err) return callback(err);
		assert(res.rowCount === 1);
		var betflag = res.rows[0].betisok;

		if(betflag == '0'){
			var sql = 'UPDATE users SET betisok = $1 where id= $2';
			query(sql, [Number('1'), dataIndex], function(err, result) {
				if(err)
					return callback(err);
				assert(result.rowCount === 1);

				callback(null);
			});
		}
		else{
			var sql = 'UPDATE users SET betisok = $1 where id= $2';
			query(sql, [Number('0'), dataIndex], function(err, result) {
				if(err)
					return callback(err);
				assert(result.rowCount === 1);

				callback(null);
			});
		}
	});
};
exports.userChatCancel = function(dataIndex, callback) {
	query('select chatisok from users where id = $1', [dataIndex], function(err, res){
		if(err) return callback(err);
		assert(res.rowCount === 1);
		var chatflag = res.rows[0].chatisok;
		if(chatflag == '0'){
			var sql = 'UPDATE users SET chatisok = $1 where id= $2';
			query(sql, [Number('1'), dataIndex], function(err, result) {
				if(err)
					return callback(err);
				assert(result.rowCount === 1);

				callback(null);
			});
		}
		else{
			var sql = 'UPDATE users SET chatisok = $1 where id= $2';
			query(sql, [Number('0'), dataIndex], function(err, result) {
				if(err)
					return callback(err);
				assert(result.rowCount === 1);

				callback(null);
			});
		}
	});
};
exports.updateBalance = function(id, balance, callback) {
	query('update users set balance_satoshis = $1 where id= $2', [Number(balance)*100 ,id], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};
exports.updateBetsize = function(id, betsize, callback) {
	query('update users set virbetsize = $1 where id= $2', [Number(betsize)*100 ,id], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};
exports.updateBetval = function(id, betval, callback) {
	query('update users set virbetval = $1 where id= $2', [Number(betval)*100 ,id], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);

		callback(null);
	});
};
/*
exports.getViewUserList = function(limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM users WHERE userclass = $1", ['user'], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
	
		query("SELECT id, username, balance_satoshis, to_char(created, 'YYYY-MM-DD HH24:MI:SS') as created FROM users WHERE userclass = $1 ORDER BY created DESC limit $2 OFFSET $3", ['user', limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					id: row.id,
					username: row.username,
					balance_satoshis: row.balance_satoshis,
					created: row.created,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};*/
exports.searchAdminUser = function(userclass, uid, solecode, username, ip_addr, partner_code, value, limit, offset, callback) {
	var total_history;
	var tcount;
	
	var	sql1 = " SELECT COUNT(*) total_count" +
			  " FROM users JOIN user_join ON users.id = user_join.user_id FULL JOIN (select * from sessions where ott = false and expired > now()) AA ON AA.user_id = users.id " +
			  "	WHERE userclass = 'user' and true ";
	var sql2 = "";
	if(userclass == 'distributor') sql2 += " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(userclass == 'partner') sql2 +=" and solecodeinput = '"+ solecode +"'";
	if(username)		sql2 += " and users.username like '%" +username + "%'";
    if(ip_addr)		sql2 += " and ip_address like '%" + ip_addr + "%'";
	if(partner_code)	sql2 += " and solecodeinput like '%" + partner_code + "%'";
	if(value)		sql2 +=" and users.username like '%" +value+ "%' or nameid like '%" +value+ "%' or solecodeinput like '%" + value + "%' or ip_address like '%" +value+ "%' or join_ip like '%" +value+ "%'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;	
		sql1 = " SELECT users.id, nameid, username, point, join_ip, solecodeinput, totalin, totalout, chatisok, outisok, logcnt, to_char(fcreated, 'YYYY-MM-DD HH24:MI:SS') as fcreated,  balance_satoshis, coalesce(AA.ip_address, '') as ip_address, join_ip, playisok, to_char(user_join.created, 'YYYY-MM-DD HH24:MI:SS') as created, join_domain, memo " +
			   " FROM users JOIN user_join ON users.id = user_join.user_id LEFT JOIN (select user_id, ip_address from sessions where created in (SELECT  MAX(created) FROM sessions GROUP BY user_id)) AA ON AA.user_id = users.id " +
			   "            LEft JOIN (SELECT max(created) as fcreated, user_id FROM sessions GROUP BY user_id) BB ON BB.user_id = users.id " +
			   "			LEFT JOIN (select sum(balance) as totalin, user_id from money_charge where pay_state = '승인' and level ='money' group by user_id) CC on CC.user_id = users.id "+
			   "			left join (select sum(balance) as totalout, user_id from money_exchange where pay_state = '승인' group by user_id) DD on DD.user_id = users.id "+
			   " WHERE userclass = 'user' and true";

		sql3 = " ORDER BY created DESC LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);

			var data = result.rows.map(function(row) {
				var balance1 = row.balance_satoshis;
				return {
					id: row.id,
					nameid: row.nameid,
					username: row.username,
					phone: row.phone,
					partner_code: row.solecodeinput,
					point: lib.formatSatoshis(row.point, 0),
					join_ip: row.join_ip,
					totalin: lib.formatSatoshis(row.totalin*100, 0),
					totalout: lib.formatSatoshis(row.totalout*100, 0),
					joincnt: row.logcnt,
					fcreated: row.fcreated,
					balance: lib.formatSatoshis(row.balance_satoshis, 0),
					ip_address: row.ip_address,
					join_ip: row.join_ip,
					created: row.created,
					join_domain: row.join_domain,
					memo: row.memo,
					chatisok: row.chatisok,
					outisok:   row.outisok,
					allowplay: row.playisok,
					total_count : tcount
				};
			});
			callback(null, data);
		 });
	});
};
exports.modifyUserInfo = function(userid, password, phone, memo, bank, owner, accountnum, callback) {
	//var hashedPassword = passwordHash.generate(password);
	query('UPDATE users SET password = $1, phone = $2, memo = $3, bankindex = $4, deposit_name = $5, accountnum = $6 WHERE id= $7', [password, phone, memo, bank, owner, accountnum, userid], function(err, result) {
		if(err)
			return callback(err);

		callback(null);
	});
};
exports.getUserInfo = function(userid, callback) {
	var sql= "select id, password, username, phone, point, balance_satoshis, memo, bankindex, totalin, totalout, deposit_name, accountnum FROM users "+
			   "LEFT JOIN (select sum(balance) as totalin, user_id from money_charge where pay_state = '승인' and level ='money' group by user_id) CC on CC.user_id = users.id "+
			   "left join (select sum(balance) as totalout, user_id from money_exchange where pay_state = '승인' group by user_id) DD on DD.user_id = users.id "+
			  " where id = $1" ;
	query(sql, [userid], function(err, result) {
		if(err)
			return callback(err);
		assert(result.rowCount === 1);
		callback(null, result.rows[0]);
	});
};
exports.getUserDetail = function(username, callback) {
	var sql ="SELECT aaa.inputmoney, aaa.username, aaa.id1, aaa.balance_satoshis, aaa.point, bbb.outputmoney "+ 
             "FROM "+
             "   (SELECT  coalesce(inputmoney, 0) as inputmoney, username, users.id as id1, balance_satoshis, point "+
             "    FROM	  users left join (select sum(balance) as inputmoney, user_id "+
             "             from   (select  balance, user_id "+
             "                     from    money_charge "+
             "                     where   pay_state='승인' and level = 'money') a "+
             "             group by user_id) aa "+
             "    ON users.id = aa.user_id "+
             "    WHERE     username ='"+username+"') aaa "+ 
             "FULL JOIN "+
             "   (SELECT  coalesce(outputmoney, 0) as outputmoney, users.id as id2 "+
             "    FROM    users left join (select sum(balance) as outputmoney, user_id "+
             "             from    (select  balance,  user_id "+
             "                      from    money_exchange "+
             "                      where   pay_state='승인') a "+
             "             group by user_id) aa "+
             "    ON users.id = aa.user_id "+
             "    WHERE     username ='"+username+"') bbb " +
             "ON aaa.id1 = bbb.id2";
	query(sql, [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows[0]);
	});
};
exports.modifybalance = function(userid, balance, point, callback) {
	console.log(balance);
	query('UPDATE users SET balance_satoshis = $1, point = $2 WHERE id = $3', [balance*100, point*100, userid], function(err, result) {
		if(err)
			return callback(err);
		callback(null, result);
	});
};
exports.searchAdminCon = function(userclass, uid, solecode, username, ip_addr, partner_code, value, limit, offset, callback) {
	var total_history;
	var tcount;
	var	sql1 = " SELECT COUNT(*) total_count" +
			  " FROM users JOIN user_join ON users.id = user_join.user_id JOIN (select * from sessions where ott = false and expired > now()) AA ON AA.user_id = users.id " +
			  "	WHERE userclass = 'user' and true ";

	var sql2 = "";
	if(userclass == 'distributor') sql2 += " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(userclass == 'partner') sql2 +=" and solecodeinput = '"+ solecode +"'";

	if(username)		sql2 += " and users.username like '%" +username + "%'";
	if(ip_addr)	sql2 += " and ip_address like '%" + ip_addr + "%'";
	if(partner_code)	sql2 += " and solecodeinput like '%" + partner_code+ "%'";
	if(value) sql2 += " and users.username like '%" +value+ "%' or nameid like '%" +value+ "%' or solecodeinput like '%" + value + "%' or ip_address like '%" +value+ "%' or join_ip like '%" +value+ "%'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;	
		
		sql1 = " SELECT users.id, nameid, username, join_ip, point, totalin, totalout, playisok, chatisok, outisok, logcnt, solecodeinput, to_char(fcreated, 'YYYY-MM-DD HH24:MI:SS') as fcreated, balance_satoshis, AA.ip_address,  to_char(user_join.created, 'YYYY-MM-DD HH24:MI:SS') as created, join_domain, memo " +
			   " FROM users JOIN user_join ON users.id = user_join.user_id JOIN (select * from sessions where ott = false and expired > now()) AA ON AA.user_id = users.id " +
			   "			LEFT JOIN (SELECT max(created) as fcreated, user_id FROM sessions GROUP BY user_id) BB ON BB.user_id = users.id " +
			   "			LEFT JOIN (select sum(balance) as totalin, user_id from money_charge where pay_state = '승인' and level ='money' group by user_id) CC on CC.user_id = users.id "+
			   "			left join (select sum(balance) as totalout, user_id from money_exchange where pay_state = '승인' group by user_id) DD on DD.user_id = users.id "+
			   " WHERE userclass = 'user' and true";

		sql3 = " ORDER BY created DESC LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);

			var data = result.rows.map(function(row) {
				var balance1 = row.balance_satoshis;
				return {
					id: row.id,
					nameid: row.nameid,
					username: row.username,
					phone: row.phone,
					partner_code: row.solecodeinput,
					point: lib.formatSatoshis(row.point, 0),
					join_ip: row.join_ip,
					totalin: lib.formatSatoshis(row.totalin*100, 0),
					totalout: lib.formatSatoshis(row.totalout*100, 0),
					joincnt: row.logcnt,
					fcreated: row.fcreated,
					balance: lib.formatSatoshis(row.balance_satoshis, 0),
					ip_address: row.ip_address,
					join_ip: row.join_ip,
					created: row.created,
					join_domain: row.join_domain,
					memo: row.memo,
					chatisok: row.chatisok,
					outisok:   row.outisok,
					allowplay: row.playisok,
					total_count : tcount
				};
			});
			callback(null, data);
		 });
	});
};
exports.getGameLog = function(id, game_created, game_no, limit, offset, callback) {
	var total_history;
	var tcount = 0;
    // Added by jjb 2017.10.21.
    var where = "";
    if(game_created) where += " and to_char(games.created, 'YYYY-MM-DD') like '%"+game_created+"%'";
    if(game_no) where += " and games.game_no = '"+game_no+"'";
    // End
    var msql = "SELECT COUNT(*) total_count FROM games join plays on games.id = plays.game_id WHERE games.ended = true and user_id = $1" + where;
	query(msql, [id], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
        
		/*
        var sql =
			"SELECT games.id game_id, game_no, game_crash, to_char(games.created, 'YYYY-MM-DD HH24:MI:SS') as created,  plays.user_id, plays.bet, (100 * cash_out / bet) AS stopped_at, bonus, " +
				   "(SELECT hash FROM game_hashes WHERE game_id = games.id) " +
			"FROM games join plays on games.id =  plays.game_id " +
			"WHERE games.ended = true and user_id = $1 " + where + 
			" ORDER BY games.id DESC LIMIT $2 OFFSET $3";
		*/
        var sql =
            "SELECT games.id game_id, game_no, game_crash, to_char(games.created, 'YY-MM-DD') as created,  plays.user_id, plays.bet, (100 * cash_out / bet) AS stopped_at, bonus, " +
                   "(SELECT hash FROM game_hashes WHERE game_id = games.id) " +
            "FROM games join plays on games.id =  plays.game_id " +
            "WHERE games.ended = true and user_id = $1 " + where + 
            " ORDER BY games.id DESC LIMIT $2 OFFSET $3";
        
            console.log(sql);
		query(sql, [id, limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				 var bonus = row.bonus;
				 var bet = row.bet;
				 if (row.stopped_at) {
					 var profit = ((row.stopped_at / 100) * row.bet) - row.bet;
					 var cashed_at = lib.formatSatoshis(row.stopped_at) + 'x';
							//If the player lost
				} else {
					profit = -bet;
					cashed_at = '-';
				}

				//If we got a bonus
				if (bonus) {
					profit = profit + bonus;
					bonus = lib.formatDecimal(bonus*100/bet, 2);
					bonus = bonus + '%';
				} else {
					bonus = '0%';
				}

				profit = lib.formatSatoshis(profit, 0);
				bet = lib.formatSatoshis(bet, 0);
				crash = lib.formatSatoshis(row.game_crash);
				return {
					game_id: row.game_id,
					game_no: row.game_no,
					game_crash: crash,
					created: row.created,
					user_id: row.user_id,
					bet: bet,
					stopped_at: cashed_at,
					bonus: bonus,
					profit: profit,
					hash: row.hash,
					total_count : tcount
				};
			});
		callback(null, data);
		});
	});
};
exports.updatestopped = function(game_id, bal, bet, user_id, callback) {
	var cash_out = Number(bet * bal * 100);

	query('update plays set cash_out = $1 where game_id= $2 and user_id = $3', [cash_out, game_id, user_id], function(err, result) {
		if(err)
			return callback(err);
		callback(null);
	});
};
exports.updatebettingsize = function(game_id, bal, user_id, at, callback) {
	var cash_out = Number(bal * at* 100);
	query('update plays set cash_out = $1, bet = $2 where game_id= $3 and user_id = $4', [cash_out, Number(bal*100), game_id, user_id], function(err, result) {
		if(err)
			return callback(err);
		callback(null);
	});
};
/*
exports.getPartnerList = function(limit, offset, callback) {
    var total_history;
	var tcount = 0;
	query("SELECT COUNT(*) total_count FROM partner", [ ], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;
		query("SELECT partner.id, name, partner_code, partner.email, partner.phone, to_char(partner.created, 'YYYY-MM-DD HH24:MI:SS') as pcreated, jibun, users.id as id1 FROM partner LEFT JOIN users ON partner.name = users.username ORDER BY pcreated DESC limit $1 OFFSET $2", [limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					id: row.id,
					name: row.name,
					partner_code: row.partner_code,
					email: row.email,
					phone: row.phone,
					created: row.pcreated,
					jibun: row.jibun,
					id1: row.id1,
					total_count : tcount
				};
			});
			callback(null, data);
		});
	});
};
*/
exports.createPartner = function(userclass, uid, pid, puid, name, email, password, phone, partner_code, jibun, pclass, plevel, callback) {
	if(!pid) pid = 0;
	var level = 0;
	var classname = '';
	var sql1 ='';
	//var hashedPassword = passwordHash.generate(password);
	query('delete from partner where id = $1', [pid],
		function(err, data){
			if(err) return callback(err);
			query('SELECT COUNT(*) count FROM partner WHERE lower(name) = lower($1)', [name],
				function(err, data) {
					if (err) return callback(err);
					assert(data.rows.length === 1);
					if (data.rows[0].count > 0)
						return callback('NAME_TAKEN');
					query('SELECT COUNT(*) count FROM partner WHERE lower(partner_code) = lower($1)', [partner_code],
						function(err, data) {
							if (err) return callback(err);
							assert(data.rows.length === 1);
							if (data.rows[0].count > 0)
								return callback('CODE_TAKEN');

							if(!pclass && userclass == 'admin') {classname = 'distributor';}
							else if(!pclass && userclass == 'distributor') {classname = 'partner';}
							else		{classname = pclass}

							if(puid) sql1 = "UPDATE users SET username = $1, password = $2, solecodeinput = $3, phone = $4, userclass = $5, playisok = $6, chatisok = $7 WHERE id = " + puid + " RETURNING id";
							else sql1 = "INSERT INTO users(username, password, solecodeinput, phone, userclass, playisok, chatisok)  VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id";
							query(sql1,	[name, password, partner_code, phone, classname, '1', '0'], function(err, result) {
								if(err)
										return callback(err);
								var partner = result.rows[0];
								assert(partner.id);

								if(!plevel && userclass == 'admin') {level = partner.id;}
								else if(!plevel && userclass == 'distributor') {level = uid;}
								else	   {level = plevel;}
										
								query('INSERT INTO partner(name, password, email, phone, partner_code, jibun, level, class)  VALUES($1, $2, $3, $4 ,$5, $6, $7, $8)',
									[name, password, email, phone, partner_code, jibun, level, classname], function(err, result) {
									if(err)
										return callback(err);
									assert(result.rowCount === 1);

									callback(null, result);
								});
							});
					});
			});
		});
};
exports.partnerDelete = function(dataIndex, callback) {
	query('select name from partner where id = $1', [dataIndex], function(err, result){
		if(err) return callback(err);
		var username = result.rows[0].name;
		
		
		query('DELETE FROM users WHERE username = $1', [username], function(err, result) {
			if(err) return callback(err);
			assert(result.rowCount === 1);

			var sql = 'Delete from partner where id= $1';
			query(sql, [dataIndex], function(err, result) {
				if(err)
					return callback(err);
				assert(result.rowCount === 1);
				callback(null);
			});
		});
	});
};
exports.partnerModify = function(dataIndex, callback) {
	var sql = 'SELECT partner.id, name, partner.password, partner_code, users.userclass, partner.email, partner.phone, jibun, partner.level, users.id as id1 '+
			  'FROM   partner left join users on partner.name = users.username '+
              'WHERE  partner.id = $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
			return callback(err);

		callback(null, result.rows[0]);
    });
};
exports.ptSearch = function(userclass, uid, name, partner_code, limit, offset, callback) {
	var total_history;
	var tcount;
	var classname= '';
	var sql2 = "";
	var totalin=0;;
	var totalout=0;
	var settotal=0;
	var facttotal=0;

		
	var	sql1 = " SELECT COUNT(*) total_count" +
			   " FROM partner " +
			   " WHERE true ";

	if(userclass == 'distributor') { sql2 += " and class='partner' and level = "+uid;}
	if(name)		sql2 += " and name like '%" +name + "%'";
	if(partner_code)	sql2 += " and partner_code like '%" + partner_code + "%'";
	var sql = sql1 + sql2;
	query(sql, [], function(err, total){
		if(err) return callback(err);
		total_history = total.rows[0];
		tcount = total_history.total_count;		
		sql1 = " SELECT partner.id as pid, name, partner_code, jibun, level, class as pclass, password, username " +
			   " FROM  partner LEFT JOIN (SELECT id, username FROM users) a ON partner.level=a.id " +
			   " WHERE true ";
		sql3 = " ORDER BY level, class LIMIT $1 OFFSET $2"

		sql = sql1 + sql2 + sql3;
		
		query(sql, [limit, offset], function(err, result) {
			if (err) return callback(err);
			var data = result.rows.map(function(row) {
				return {
					id: row.pid,
					name: row.name,
					partner_code: row.partner_code,
					jibun: row.jibun,
					level: row.level,
					pclass: row.pclass,
					password: row.password,
					belong: row.username,
					total_count : tcount
				};
			});
			callback(null, data);
			/*var data = result.rows.map(function(row) {
				var dbname='';
				var sql1='';
				if(row.pclass == 'distributor') {dbname = 'distributor_view'; sql1 = " and level="+row.level;}
				else if(row.pclass == 'partner') { dbname = 'partner_view'; sql1 = " and name='"+row.name+"'" ;}
				var sql = "select sum(inmoney) as totalin, sum(outmoney) as totalout from "+dbname+ " where true";
				sql = sql+sql1;
				query(sql, [], function(err, res) {
					if(err) return callback(err);
					 totalin = res.rows[0].totalin;
					 totalout = res.rows[0].totalout;
					 console.log(totalin, totalout);
					query("select sum(inmoney) as intotal, sum(outmoney) as outtotal from settlement where solecode = $1", [row.partner_code], function(err, res1) {
						if (err) return callback(err);
						 var intotal = res1.rows[0].intotal;
						 var outtotal = res1.rows[0].outtotal;
						 settotal = Number(intotal) - Number(outtotal);
						 facttotal = Number(settotal) * Number(row.jibun);
					});
				});	 
				console.log("aaaaaaaaaaaa", totalin, totalout);
				return {
					id: row.pid,
					name: row.name,
					partner_code: row.partner_code,
					jibun: row.jibun,
					level: row.level,
					pclass: row.pclass,
					password: row.password,
					belong: row.username,
					total_count : tcount,
					totalin: lib.formatSatoshis(totalin*100, 0),
					totalout: lib.formatSatoshis(totalout*100, 0),
					settotal: lib.formatSatoshis(settotal*100, 0),
					profit: lib.formatSatoshis(facttotal, 0)
				};
			});
			callback(null, data);*/
		});
	});
};
exports.searchPartnercode = function(dataIndex, callback) {
	var sql = 'select id from partner where partner_code = $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
			return callback(err);
		
		callback(null, result.rows[0]);
    });
};
exports.searchusername = function(dataIndex, callback) {
	var sql = 'select id from users where username = $1';
    query(sql, [dataIndex], function(err, result) {
        if(err)
			return callback(err);
		
		callback(null, result.rows[0]);
    });
};
exports.dateSearch = function(userclass, solecode, fromdate, enddate, callback) {
	var sql='';
	var param = [];
	if(userclass=='admin')
		solecode = 'admin';
	if(userclass == 'admin'){
        sql = "SELECT SUM(inmoney) AS totalin, SUM(outmoney) AS totalout FROM settlement WHERE date(datetime) >= $1 and date(datetime) <= $2";
        param = [fromdate, enddate];
    }
    else{
        sql = "SELECT SUM(inmoney) AS totalin, SUM(outmoney) AS totalout, jibun FROM settlement WHERE solecode = $1 and date(datetime) >= $2 and date(datetime) <= $3 GROUP BY solecode, jibun";
        param = [solecode, fromdate, enddate];
    }
	//sql = "SELECT SUM(inmoney) AS totalin, SUM(outmoney) AS totalout, jibun FROM settlement WHERE solecode = $1 and date(datetime) >= $2 and date(datetime) <= $3 GROUP BY solecode, jibun";
	query(sql, param, function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			var profit = (userclass=='admin')? (row.totalin - row.totalout)*100 : (row.totalin - row.totalout)*row.jibun;
			return {
				totalin: lib.formatSatoshis(row.totalin*100, 0),
				totalout: lib.formatSatoshis(row.totalout*100, 0),
				profit: lib.formatSatoshis(profit, 0)
			};
		});
		callback(null, data);
	});
};
exports.viewDetailSettlement = function(userclass, solecode, fromdate, enddate, callback) {
	var sql='';
	var param = [];
	if(userclass=='admin')
		solecode = 'admin';
	if(userclass == 'admin'){
        sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE date(datetime) >= $1 and date(datetime) <= $2 ORDER BY datetime";
        param = [fromdate, enddate];
    }
    else{
        sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE solecode = $1 and date(datetime) >= $2 and date(datetime) <= $3 ORDER BY datetime";
        param = [solecode, fromdate, enddate];
    }
	//sql = "SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun FROM settlement WHERE solecode = $1 and date(datetime) >= $2 and date(datetime) <= $3 ORDER BY datetime";
	query(sql, param, function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			var profit = (row.inmoney - row.outmoney)*row.jibun; 
			return {
				date: row.datetime,
				solecode: row.solecode,
				inmoney: lib.formatSatoshis(row.inmoney*100, 0),
				outmoney: lib.formatSatoshis(row.outmoney*100, 0),
				profit: lib.formatSatoshis(profit, 0)
			};
		});
		callback(null, data);
	});
};
exports.infoFormat = function(userclass, solecode, fromdate, enddate, callback) {
	var sql='';
	if(userclass=='admin')
		solecode = 'admin';
	query('DELETE FROM settlement WHERE date(datetime) >= $1 and date(datetime) <= $2', [fromdate, enddate], function(err, result) {
		if(err)	return callback(err);
		callback(null);
	});
};

exports.calDate = function(date, callback) {
	var sql = '';
	if(!date) sql = "select to_char(current_date, 'YYYY-MM-DD') as date"; 
	else sql = "select date('" + date + "') as date";
    query(sql, [], function(err, result) {
        if(err)
			return callback(err);
		
		callback(null,result.rows[0]);
    });
};

exports.todaymoneyByUser = function(userclass, uid, solecode, username, date, callback) {
	var sql2='';
	if(username)	sql2 = " and username like '%" + username + "%'";
	if(userclass == 'distributor') sql2 += " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +" or partner_code = '"+ solecode +"')"; 
	else if(userclass == 'partner') sql2 +=" and solecodeinput = '"+ solecode +"'";

	var sql1 = "select * " +
			  "from " +
			  "			(select inputmoney, username, solecodeinput, users.id as id1, balance_satoshis" +
			  "			from (select sum(balance) as inputmoney, user_id" +
			  "				   from (  select balance, user_id" +
			  "						from money_charge" +
			  "						where pay_state='승인' and level = 'money' date(end_datetime) = '"+ date +"') a" +
			  "				   group by user_id) aa" +
			  "			left join users on users.id = aa.user_id) aaa " +
			  "full join" +
			  "			(select outputmoney, users.id as id2" +
			  "			from (select sum(balance) as outputmoney, user_id" +
			  "				   from (  select balance, user_id" +
			  "						from money_exchange" +
			  "						where pay_state='승인' and date(end_datetime) = '" + date + "' ) a" +
			  "				   group by user_id) aa" +
			  "			left join users on users.id = aa.user_id) bbb " +
			  "on aaa.id1 = bbb.id2 " +
			  "where true";
	sql = sql1 + sql2;
	query(sql, [], function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			var profit = row.inputmoney - row.outputmoney; 
			return {
				id1: row.id1,
				username: row.username,
				solecodeinput: row.solecodeinput,
				inputmoney: lib.formatSatoshis(row.inputmoney*100, 0),
				outputmoney: lib.formatSatoshis(row.outputmoney*100, 0),
				balance_satoshis: lib.formatSatoshis(row.balance_satoshis, 0)
			};
		});
		callback(null, data);
	});
};
exports.setPlayGame = function(uid, callback) {
	var sql = "select playisok from users where id = $1";
    query(sql, [uid], function(err, result) {
        if(err)
			return callback(err);
		if(result.rows[0].playisok == 0)
			var sql1 = "update users set playisok = 1 where id = $1";
		else
			var sql1 = "update users set playisok = 0 where id = $1";
		query(sql1, [uid], function(err, result1) {
			if(err)
				return callback(err);
			callback(null,result1);
		});
	});
};
exports.badiplist = function(callback) {
	query("SELECT id, ip_addr, to_char(datetime, 'YYYY-MM-DD') as datetime FROM bad_ip", [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.badipDelete = function(uid, callback) {
	query("DELETE FROM bad_ip WHERE id = $1", [uid], function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
};
exports.badipAdd = function(badip, callback) {
	query("INSERT INTO bad_ip (ip_addr) VALUES ($1)", [badip], function(err, result) {
		if (err) return callback(err);
			callback(null, result);
	});
};
exports.modifymax = function(money, callback) {
	query("DELETE FROM money", [], function(err, result) {
		if(err) return callback(err);

		query("INSERT INTO money (max_profit) VALUES ($1)", [money*100], function(err, result) {
			if (err) return callback(err);
				callback(null, result);
		});
	});
};
exports.accountlist = function(callback) {
	query("SELECT * FROM account ORDER BY created DESC", [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.insertAccount = function(bank, accountnum, owner, memo, callback) {
	query("INSERT INTO account (bank, accountnum, owner, memo) VALUES ($1, $2, $3, $4)", [bank, accountnum, owner, memo], function(err, result) {
		if (err) return callback(err);
			callback(null, result);
	});
};
exports.modifyAccount = function(bank, accountnum, owner, memo, uid, callback) {
	query("UPDATE account SET bank = $1, owner = $2, accountnum = $3, memo = $4 WHERE id = $5", [bank, owner, accountnum, memo, uid], function(err, result) {
		if (err) return callback(err);
			callback(null, result);
	});
};
exports.deleteAccount = function(uid, callback) {
	query("DELETE FROM account WHERE id = $1", [uid], function(err, result) {
		if (err) return callback(err);
			callback(null, result);
	});
};
exports.selectAccount = function(uid, state, callback) {
	query("UPDATE account SET isok = $1 WHERE id = $2", [state, uid], function(err, result) {
		if (err) return callback(err);
			callback(null, result);
	});
};
exports.getListByCode = function(code,callback) {
	var sql ="SELECT id, username, balance_satoshis, solecodeinput, coalesce(totalin, 0) as totalin, coalesce(totalout, 0) as totalout " +
			 "FROM   users LEFT JOIN (SELECT coalesce(totalin, 0) as totalin, coalesce(totalout,0) as totalout,  a.user_id " +
									" FROM  (select   sum(balance) as totalin, user_id " +
										  "	 from     money_charge " +
										  "  where    pay_state='승인' and level = 'money' " +
										  "	 group by user_id) a full join " +
										  "	(select   sum(balance) as totalout, user_id " +
 										  "	 from     money_exchange " +
 										  "	 where    pay_state='승인' " +
 										  "	 group by user_id) b on a.user_id = b.user_id) AA " +
						  "	ON users.id = AA.user_id " +
			" WHERE solecodeinput = $1 AND userclass = 'user' ORDER BY created DESC";
	query(sql, [code], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.findChargeChange = function(uid,callback) {
	query("SELECT pay_state, end_datetime FROM money_charge WHERE user_id = $1 and level = 'money' ORDER BY request_datetime DESC", [uid], function(err, result) {
		if (err) return callback(err);

		callback(null, result.rows);
	});
};
exports.getInputInfo = function(userclass, uid, limit, offset, callback) {
	var sql = " SELECT id, to_char(coalesce(end_datetime, request_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime, balance, pay_state, inbank, inowner, inaccountnum "+
			  " FROM money_charge "+
			  " WHERE user_id = $1 and level = 'money' and true";
	var sql1='';
	if(userclass == 'distributor' || userclass == 'partner') sql1 = " and pay_state = '승인'";
    var sql2 = sql+sql1;
	sql = sql + sql1 + " ORDER BY datetime DESC LIMIT " + limit + " OFFSET " + offset;
	query(sql, [uid], function(err, results) {
		if (err) return callback(err);
		var data = results.rows.map(function(row) {
			return {
				id: row.id,
				datetime: row.datetime,
				pay_state: row.pay_state,
				bank: row.inbank,
				owner: row.inowner,
				accountnum: row.inaccountnum,
				balance: lib.formatSatoshis(row.balance*100, 0)
			};
		});
        query(sql2, [uid], function(err, result){
            if (err) return callback(err);
            console.log('[length1]', result.rows.length);
            data.total_count = result.rows.length;
        });
		callback(null, data);
	});
};
exports.getOutputInfo = function(userclass, uid, limit, offset, callback) {
	var sql = " SELECT money_exchange.id, to_char(coalesce(end_datetime, request_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime, balance, pay_state, outbank, outaccountnum, outowner "+
			  " FROM money_exchange "+
			  " WHERE user_id = $1 and true";
	var sql1 = '';
	if(userclass == 'distributor' || userclass == 'partner') sql1 = " and pay_state = '승인'";
    var sql2 = sql+sql1;
	sql = sql + sql1 + " ORDER BY datetime DESC LIMIT " + limit + " OFFSET " + offset;
	query(sql, [uid], function(err, results) {
		if (err) return callback(err);
		var data = results.rows.map(function(row) {
			return {
				id: row.id,
				datetime: row.datetime,
				pay_state: row.pay_state,
				balance: lib.formatSatoshis(row.balance*100, 0),
				bankindex: row.outbank,
				accountnum: row.outaccountnum,
				deposit_name: row.outowner
			};
		});
        query(sql2, [uid], function(err, result){
            if (err) return callback(err);
            console.log('[length2]', result.rows.length);
            data.total_count = result.rows.length;
        });
		callback(null, data);
	});
};
exports.getPointInfo = function(userclass, uid, limit, offset, callback) {
	var sql = " SELECT id, to_char(coalesce(end_datetime, request_datetime), 'YYYY-MM-DD HH24:MI:SS') as datetime, balance, pay_state "+
			  " FROM money_charge "+
			  " WHERE user_id = $1 and level = 'point' and true ";
	var sql1 = '';
	if(userclass == 'distributor' || userclass == 'partner') sql1 = " and pay_state = '승인'";
    var sql2 = sql+sql1;
	sql = sql + sql1 + " ORDER BY datetime DESC LIMIT " + limit + " OFFSET " + offset;
	query(sql, [uid], function(err, results) {
		if (err) return callback(err);
		var data = results.rows.map(function(row) {
			return {
				id: row.id,
				datetime: row.datetime,
				pay_state: row.pay_state,
				balance: lib.formatSatoshis(row.balance*100, 0)
			};
		});
        query(sql2, [uid], function(err, result){
            if (err) return callback(err);
            console.log('[length3]', result.rows.length);
            data.total_count = result.rows.length;
        });
		callback(null, data);
	});
};
exports.getSumIO = function(uid, callback) {
	sql = "SELECT * "+
		  "FROM "+
			"(SELECT  COALESCE(sum(balance), 0) as total_in "+
			" FROM    money_charge "+
			" WHERE   user_id = $1 and pay_state = $2 and level ='money') a, "+
			"(SELECT  COALESCE(sum(balance), 0) as total_out "+
			" FROM    money_exchange "+
			" WHERE   user_id = $1 and pay_state = $2) b, "+ 
			"(SELECT  COALESCE(sum(balance), 0) as total_point "+
			" FROM    money_charge "+
			" WHERE   user_id = $1 and pay_state = $2 and level ='point') c";
	query(sql, [uid, '승인'], function(err, result) {
        if(err)
			return callback(err);
		callback(null, result.rows[0]);
    });
};
exports.moneyInDelete = function(id,callback) {
	query("DELETE FROM money_charge WHERE id = $1", [id], function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
};
exports.moneyOutDelete = function(id,callback) {
	query("DELETE FROM money_exchange WHERE id = $1", [id], function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
};
exports.forceout = function(uid,callback) {
	query("UPDATE users SET outisok = 1 WHERE id = $1", [uid], function(err, result) {
		if (err) return callback(err);
		query('UPDATE sessions SET expired = now() WHERE user_id = $1 AND expired > now()', [uid], function(err, result){
			if (err) return callback(err);
			callback(null, result);
		});
	});
};
exports.cancelout = function(uid,callback) {
	query("UPDATE users SET outisok = 0 WHERE id = $1", [uid], function(err, result) {
		if (err) return callback(err);
		callback(null, result);
	});
};
exports.getUserChatIsOk = function(uid, callback) {
    assert(uid);
    query('SELECT chatisok FROM users WHERE id = $1', [uid], function(err, result) {
        if (err) return callback(err);
        if (result.rows.length === 0)
            return callback('USER_DOES_NOT_EXIST');

        assert(result.rows.length === 1);
        callback(null, result.rows[0]);
    });
};
exports.todaySettlement = function(bydate1, bydate2, username, callback) {
	assert(bydate1);
    assert(bydate2);
    var sql = "INSERT INTO settlement_finish (id, from_date, end_date, register, reg_time) VALUES (nextval('settlement_finish_id_seq'),$1, $2, $3, now())";
    query(sql, [bydate1, bydate2, username], function(err, result){
        if(err) callback(err);
        callback(null, result);
    });
    /*
	query("DELETE FROM settlement WHERE date(datetime) >= $1 and date(datetime)<= $2", [bydate1, bydate2], function(err, result) {
		query('SELECT * FROM admin_view WHERE date1 >=$1 and date1 <= $2', [bydate1, bydate2], function(err, result) {
			if (err) return callback(err);
			result.rows.forEach(function(row) {
				query("INSERT INTO settlement (datetime, inmoney, outmoney, solecode, jibun) VALUES ($1, $2, $3, $4, $5)", [row.date1, row.inmoney, row.outmoney, 'admin', 100], function(err, result) {
					if (err) return callback(err);
				});
			});
			query('SELECT * FROM distributor_view WHERE date1 >=$1 and date1 <= $2', [bydate1, bydate2], function(err, result) {
				if(err) return callback(err);
				result.rows.forEach(function(row){
					query('select partner_code, jibun from partner where name in (select username from users where id = $1)', [row.level], function(err, res) {
						if(err) return callback(err);
						var sole = res.rows[0].partner_code;
						var jibun = res.rows[0].jibun;
						query("INSERT INTO settlement (datetime, inmoney, outmoney, solecode, jibun) VALUES ($1, $2, $3, $4, $5)", [row.date1, row.inmoney, row.outmoney, sole, jibun], function(err, result) {
							if (err) return callback(err);
						});
					});
				});
				query('SELECT * FROM partner_view WHERE date1 >=$1 and date1 <= $2', [bydate1, bydate2], function(err, result) {
					if(err) return callback(err);
					result.rows.forEach(function(row){
						query('select partner_code, jibun from partner where name = $1', [row.name], function(err, res) {
							if(err) return callback(err);
							var sole = res.rows[0].partner_code;
							var jibun = res.rows[0].jibun;
							query("INSERT INTO settlement (datetime, inmoney, outmoney, solecode, jibun) VALUES ($1, $2, $3, $4, $5)", [row.date1, row.inmoney, row.outmoney, sole, jibun], function(err, result) {
								if (err) return callback(err);
							});
						});
					});
				});
			});
		});
		callback(null, result);
	});
	*/
};
/*
exports.settlementFinish = function(bydate1, bydate2, callback) {
    assert(bydate2);
	query("SELECT to_char(from_date, 'YYYY-MM-DD') as from_date, to_char(end_date, 'YYYY-MM-DD') as end_date FROM settlement_finish WHERE classname='admin'", [], function(err, results){
		if(err) return callback(err);
		results.rows.forEach(function(row){
			var fdate = row.from_date;
			var edate = row.end_date;
			if(edate >= bydate1) {
				var date1 = new Date(edate);
				var date2 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate()+2);
				bydate1 = date2.toISOString().substring(0, 10);
			}
		});
		var sql = "SELECT COALESCE(SUM(profit), 0) as profit, solecode, COALESCE(SUM(inmoney), 0) as totalin,  COALESCE(SUM(outmoney), 0) as totalout, jibun "+
				  "FROM ( SELECT (inmoney-outmoney)*jibun as profit, inmoney, outmoney, jibun, solecode "+
						" FROM settlement "+
						" WHERE date(datetime) >= $1 and date(datetime) <= $2 ) a "+
				  "GROUP BY solecode , jibun";
		query(sql, [bydate1, bydate2], function(err, result) {
			if (err) return callback(err);
			result.rows.forEach(function(row){
				query('SELECT name, class as classname from partner where partner_code = $1', [row.solecode], function(err, res) {
					if(err) return callback(err);
					var name;
					var classname;
					if(row.solecode=='admin' && !res.rows[0]) {
						name ='maxline'; 
						classname='admin';
					}
					else{
						name = res.rows[0].name;
						classname = res.rows[0].classname;
					}
					query("INSERT INTO settlement_finish (from_date, end_date, classname, partner_name, partner_code, profit, totalin, totalout, jibun) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [bydate1, bydate2, classname, name, row.solecode, row.profit, row.totalin, row.totalout, row.jibun], function(err, result) {
						if (err) return callback(err);
					});
				});
			});
			callback(null,result);
		});
	});
};*/
exports.calendar = function(day, end_date, userclass, solecodeinput, callback) {
	if(userclass=='admin')
		solecodeinput = 'admin';
	var sql = "SELECT  to_char(datetime, 'YYYY-MM-DD') as datetime, inmoney, outmoney, solecode, jibun "+ 
			  "FROM    settlement "+
			  "WHERE   date(datetime) >=$1 and date(datetime) < $2 and solecode = $3";
	query(sql, [day, end_date, solecodeinput], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.allIOData = function(day, end_date, userclass, uid, uname, callback) {
	var dbname;
	var sql1='';
	if(userclass=='admin'){
		solecodeinput = 'admin';
		dbname = 'admin_view';
	}
	else if(userclass=='distributor') {
		dbname = 'distributor_view';
		sql1 = " and level="+uid;
	}
	else {
		dbname = 'partner_view';
		sql1 = " and name='"+uname+"'";
	}
	var sql = "select inmoney, outmoney, to_char(date1, 'YYYY-MM-DD') as date1 from "+dbname+" where date1>=$1 and date1 < $2 and true";
	sql = sql+sql1;
	query(sql, [day, end_date], function(err, result) {
		if(err) return callback(err);
		callback(null, result.rows);

	});
};
exports.totalinout = function(userclass, uid, uname, solecode, callback) {
    var total_bal   = 0;
    var total_point = 0;
    var total_in    = 0;
    var total_out   = 0;
    var profit      = 0;
    if(userclass == 'admin'){
        var sql = "SELECT SUM(balance_satoshis) AS total_bal, SUM(point) AS total_point FROM users WHERE userclass='user'";
        query(sql, function(err, result){
            if(err) callback(err);
            total_bal   = result.rows[0].total_bal;
            total_point = result.rows[0].total_point;
            var sql = "SELECT SUM(inmoney) AS total_in, SUM(outmoney) AS total_out FROM settlement";
            query(sql, function(err, result){
                if(err) callback(err);
                total_in    = result.rows[0].total_in;
                total_out   = result.rows[0].total_out;
                profit      = Number(result.rows[0].total_in) - Number(result.rows[0].total_out);
                callback(null, {
                    total_bal: total_bal,
                    total_point: total_point,
                    total_in: total_in,
                    total_out: total_out,
                    profit: profit
                });
            });
        });
    }
    if(userclass == 'distributor') {
        var sql = "SELECT SUM(balance_satoshis) AS total_bal, SUM(point) AS total_point FROM users WHERE userclass='user' AND solecodeinput IN (SELECT partner_code FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1))";

        query(sql, [solecode], function (err, result) {
            if (err) callback(err);
            total_bal = result.rows[0].total_bal;
            total_point = result.rows[0].total_point;
            var sql = "SELECT SUM(inmoney) AS total_in, SUM(outmoney) AS total_out FROM settlement WHERE solecode IN (SELECT partner_code FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1))";
            query(sql, [solecode], function (err, result) {
                if (err) callback(err);
                total_in    = result.rows[0].total_in;
                total_out   = result.rows[0].total_out;
                profit      = Number(result.rows[0].total_in) - Number(result.rows[0].total_out);
                callback(null, {
                    total_bal: total_bal,
                    total_point: total_point,
                    total_in: total_in,
                    total_out: total_out,
                    profit: profit
                });
            });
        });
    }
    if(userclass == 'partner') {
        var sql = "SELECT SUM(balance_satoshis) AS total_bal, SUM(point) AS total_point FROM users WHERE userclass='user' AND solecodeinput=$1";

        query(sql, [solecode], function (err, result) {
            if (err) callback(err);
            total_bal = result.rows[0].total_bal;
            total_point = result.rows[0].total_point;
            var sql = "SELECT SUM(inmoney) AS total_in, SUM(outmoney) AS total_out FROM settlement WHERE solecode=$1";
            query(sql, [solecode], function (err, result) {
                if (err) callback(err);
                total_in    = result.rows[0].total_in;
                total_out   = result.rows[0].total_out;
                profit      = Number(result.rows[0].total_in) - Number(result.rows[0].total_out);
                callback(null, {
                    total_bal: total_bal,
                    total_point: total_point,
                    total_in: total_in,
                    total_out: total_out,
                    profit: profit
                });
            });
        });
    }
    /*
	var dbname;
	var sql1='';
	var psql2 = '';
	if(userclass=='admin'){
		solecode = 'admin';
		dbname = 'admin_view';
	}
	else if(userclass=='distributor') {
		dbname = 'distributor_view';
		sql1 = " and level="+uid;
		psql2 = " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")";
	}
	else if(userclass == 'partner') {
		dbname = 'partner_view';
		sql1 = " and name='"+uname+"'";
		psql2 = " and solecodeinput = '"+ solecode +"'";

	}
	var psql = "SELECT sum(balance_satoshis) as total_bal, sum(point) as total_point FROM users WHERE userclass = 'user' and true";
	psql = psql + psql2;
	query(psql, [], function(err, result) {
		if(err) return callback(err);
		var total_bal = result.rows[0].total_bal;
		var total_point = result.rows[0].total_point;
		var sql = "select sum(inmoney) as totalin, sum(outmoney) as totalout from "+dbname+" where true";
		sql = sql+sql1;
		query(sql, [], function(err, result) {
			if(err) return callback(err);
			var totalin = result.rows[0].totalin;
			var totalout = result.rows[0].totalout;
			query("select coalesce(sum(inmoney), 0) as intotal, coalesce(sum(outmoney), 0) as outtotal from settlement where solecode = $1", [solecode], function(err, results){
				if(err) return callback(err);
				var profit = Number(results.rows[0].intotal) - Number(results.rows[0].outtotal);
				callback(null, {totalin: totalin, totalout: totalout, profit: profit, total_bal: total_bal, total_point: total_point}); 
			});
		});
	});
	*/
}
exports.getBydateIn = function(uid, userclass, solecode, sdate, callback) {
	var sql2='';
	if(userclass == 'distributor') sql2 += " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(userclass == 'partner') sql2 +=" and solecodeinput = '"+ solecode +"'";

	var sql = " SELECT to_char(end_datetime, 'YYYY-MM-DD HH24:MI:SS') as datetime, username, pname, pclass, solecodeinput, balance, pay_state, inbank, inowner, inaccountnum "+
			  " FROM money_charge LEFT JOIN ( "+
			  "			select username, partner.name as pname, partner.class  as pclass , users.id as uid, solecodeinput "+
			  "			from users left join partner on users.solecodeinput = partner.partner_code) a  on user_id = a.uid "+
			  " WHERE pay_state='승인' AND date(end_datetime) = $1 AND money_charge.level ='money'";
	sql = sql + sql2;
	query(sql, [sdate], function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			return {
				datetime: row.datetime,
				username: row.username,
				solecode: row.solecodeinput,
				pname: row.pname,
				pclass: row.pclass,
				pay_state: row.pay_state,
				balance: lib.formatSatoshis(row.balance*100, 0),
				inbank: row.inbank,
				inaccountnum: row.inaccountnum,
				inowner: row.inowner
			};
		});
		callback(null, data);
	});
}
exports.getBydateOut = function(uid, userclass, solecode, sdate, callback) {
	var sql2='';
	if(userclass == 'distributor') sql2 += " and solecodeinput in (SELECT partner_code FROM partner WHERE level = "+ uid +")"; 
	else if(userclass == 'partner') sql2 +=" and solecodeinput = '"+ solecode +"'";
	var sql = " SELECT to_char(end_datetime, 'YYYY-MM-DD HH24:MI:SS') as datetime, username, pname, pclass, solecodeinput, balance, pay_state, outbank, outowner, outaccountnum "+
			  " FROM money_exchange LEFT JOIN ( "+
			  "			select username, partner.name as pname, partner.class  as pclass , users.id as uid, solecodeinput "+
			  "			from users left join partner on users.solecodeinput = partner.partner_code) a  on user_id = a.uid "+
			  " WHERE pay_state='승인' AND date(end_datetime) = $1";
	sql = sql + sql2 + ' ORDER BY datetime DESC';
	query(sql, [sdate], function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			return {
				datetime: row.datetime,
				username: row.username,
				solecode: row.solecodeinput,
				pname: row.pname,
				pclass: row.pclass,
				pay_state: row.pay_state,
				balance: lib.formatSatoshis(row.balance*100, 0),
				outbank: row.outbank,
				outaccountnum: row.outaccountnum,
				outowner: row.outowner
			};
		});
		callback(null, data);
	});
}
exports.getBydateSet = function(uid, userclass, solecode, sdate, callback) {
	var sql2='';
	if(userclass == 'admin') sql2 += " and solecode in (SELECT partner_code FROM partner WHERE class ='distributor')";
	else if(userclass == 'distributor') sql2 += " and solecode in (SELECT partner_code FROM partner WHERE class = 'partner' and level = "+ uid +")"; 
	else if(userclass == 'partner') sql2 +=" and solecode = '"+ solecode +"'";
	var sql = " SELECT to_char(datetime, 'YYYY-MM-DD') as datetime, solecode, inmoney, outmoney, settlement.jibun, partner.name, partner.class as class1"+
			  " FROM settlement left join partner on settlement.solecode = partner.partner_code"+
			  " WHERE  date(datetime) = $1";
	sql = sql + sql2;
	// console.log(sql);
	query(sql, [sdate], function(err, result) {
		if (err) return callback(err);
		var data = result.rows.map(function(row) {
			return {
				datetime: row.datetime,
				solecode: row.solecode,
				pclass: row.class1,
				jibun: row.jibun,
				name: row.name,
				totalin: lib.formatSatoshis(row.inmoney*100, 0),
				totalout: lib.formatSatoshis(row.outmoney*100, 0),
				profit: lib.formatSatoshis((Number(row.inmoney) - Number(row.outmoney))*row.jibun, 0)
			};
		});
		callback(null, data);
	});
}

exports.viewPartnerList = function(uid, uclass, solecodeinput, callback) {
	var sql1='';
	if(uclass=='admin')
		sql1 = " and class = 'distributor'";
	else if(uclass == 'distributor')
		sql1 = " and level ="+uid+" and class = 'partner'";
	var sql = "SELECT name, partner_code,jibun FROM partner WHERE true";
	sql = sql + sql1;
	query(sql, [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows);
	});
};
exports.findParentCode = function(solecode, callback){
    var sql = "SELECT partner_code FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1) AND class='distributor'";
    query(sql, [solecode], function(err, result){
        if (err) return callback(err);
        callback(null, result.rows[0]);
    });
};
exports.viewPartnerList1 = function(solecodeinput, callback) {
    var sql = "SELECT name, partner_code,jibun FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1) AND class='partner'";
    query(sql, [solecodeinput], function(err, result) {
        if (err) return callback(err);
        callback(null, result.rows);
    });
};
exports.findUnreadCount = function(uid, callback) {
	query("SELECT unread_count, unread_charge, unread_exchange, unread_qna, unread_rpy, logcnt, userclass FROM users_view WHERE id = $1", [uid], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows[0]);
	});
};
exports.convertLocalTimezone = function(date){
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().substring(0, 10);
};
exports.viewBalAccount = function(uid, solecode, userclass, username, bydate1, bydate2, callback) {
	var sql  = "";
    var param = [];

    if(userclass == 'admin'){
        sql = "SELECT " +
            "settlement.*, " +
            "partner.name, " +
            "partner.class, " +
            "partner.level, " +
            "CASE " +
            "    WHEN partner.class='distributor' THEN '총판' " +
            "    WHEN partner.class='partner' THEN '파트너' " +
            "  END  " +
            "  AS classname " +
            "FROM " +
            "settlement " +
            "LEFT JOIN partner ON settlement.solecode=partner.partner_code " +
            "WHERE " +
            "date(datetime) >= $1 and date(datetime) <= $2 " +
            "ORDER BY datetime ASC";
        param = [bydate1, bydate2];
    }
    if(userclass == 'distributor'){
        sql = "SELECT " +
            "settlement.*, " +
            "partner.name, " +
            "partner.class, " +
            "partner.level, " +
            "CASE " +
            "    WHEN partner.class='distributor' THEN '총판' " +
            "    WHEN partner.class='partner' THEN '파트너' " +
            "  END  " +
            "  AS classname " +
            "FROM " +
            "settlement " +
            "LEFT JOIN partner ON settlement.solecode=partner.partner_code " +
            "WHERE settlement.solecode IN (SELECT partner_code FROM partner WHERE level IN (SELECT level FROM partner WHERE partner_code=$1)) " +
            "AND date(datetime) >= $2 and date(datetime) <= $3 " +
            "ORDER BY datetime ASC";
        param = [solecode, bydate1, bydate2];
    }
    if(userclass == 'partner'){
        sql = "SELECT " +
            "settlement.*, " +
            "partner.name, " +
            "partner.class, " +
            "partner.level, " +
            "CASE " +
            "    WHEN partner.class='distributor' THEN '총판' " +
            "    WHEN partner.class='partner' THEN '파트너' " +
            "  END  " +
            "  AS classname " +
            "FROM " +
            "settlement " +
            "LEFT JOIN partner ON settlement.solecode=partner.partner_code " +
            "WHERE settlement.solecode =$1 " +
            "AND date(datetime) >= $2 and date(datetime) <= $3 " +
            "ORDER BY datetime ASC";
        param = [solecode, bydate1, bydate2];
    }
    var sql1 = "SELECT * FROM settlement_finish";
    query(sql1, [], function(err, result){
        var settlementDate = [];
        if(err) callback(err);
        settlementDate = result.rows;
        query(sql, param, function(err, result){
            if(err) callback(err);
            var data = result.rows.map(function(row){
                var state='';
                settlementDate.forEach(function(item){
                    var ff_date = item.from_date.toISOString().substring(0, 10);
                    var ee_date = item.end_date.toISOString().substring(0, 10);
                    var nn_date = row.datetime.toISOString().substring(0, 10);
                    if(ff_date <= nn_date && nn_date <= ee_date){
                        state = '만료';
                    }
                    //else state = '준비중'
                });
                return {
                    datetime : row.datetime.toISOString().substring(0, 10),
                    classname: row.classname,
                    name: row.name,
                    totalin: lib.formatSatoshis(row.inmoney*100, 0),
                    totalout: lib.formatSatoshis(row.outmoney*100, 0),
                    jibun: row.jibun,
                    profit: lib.formatSatoshis((Number(row.inmoney) - Number(row.outmoney))*row.jibun, 0),
                    state: state,
                    userclass: row.class
                };
            });
            callback(null, data);
        });
    });
    /*
    var sql1 = '';
	var sql = '';
	if(userclass == 'admin' || userclass == 'distributor'){
		sql = " select inmoney, outmoney, date1,  name, class1, jibun, level, partner_code, coalesce(state, '') as state " +
			  " from ( "+
			  " select inmoney, outmoney, to_char(date1, 'YYYY-MM-DD') as date1, A.level, B.name, B.class as class1, B.jibun, B.partner_code "+
			  " from distributor_view A left join (select * from partner where partner.class = 'distributor')  B on B.level = A.level )a "+
			  " left join(select to_char(datetime, 'YYYY-MM-DD') as vdate, text('완료') as state from settlement group by vdate) c on a.date1 = c.vdate "+
			  " where date(date1) >= $1 and date(date1) <= $2 and true ";
		if(userclass == 'distributor') sql1 = " and level ="+uid;

		sql = sql + sql1;
	}
	else if(userclass == 'partner') {
		sql = " select inmoney, outmoney, date1, name, class1, jibun, partner_code, coalesce(state, '') as state "+
			  " from ( "+
			  " select inmoney, outmoney, to_char(date1, 'YYYY-MM-DD') as date1, B.name, B.class as class1, B.jibun, B.partner_code "+
			  " from partner_view A left join (select * from partner where partner.class = 'partner')  B on B.name = A.name )a "+
			  " left join(select to_char(datetime, 'YYYY-MM-DD') as vdate, text('완료') as state from settlement group by vdate) c on a.date1 = c.vdate "+ 
			  " where date(date1) >= $1 and date(date1) <= $2 and  A.name = '"+ username +"'";
	}
	query(sql, [bydate1, bydate2], function(err, result) {
		if(err) return callback(err);

		var data = result.rows.map(function(row){
			return {
				datetime : row.date1,
				classname: row.class1,
				name: row.name,
				totalin: lib.formatSatoshis(row.inmoney*100, 0),
				totalout: lib.formatSatoshis(row.outmoney*100, 0),
				jibun: row.jibun,
				profit: lib.formatSatoshis((Number(row.inmoney) - Number(row.outmoney))*row.jibun, 0),
				state: row.state
			};
		});
		callback(null, data);
	});
	*/
};
exports.gettotalProfit = function(bydate1, bydate2, callback) {
	var sql = "select sum(inmoney) as ti, sum(outmoney) as to from admin_view where date(date1) >= $1 and date(date1) <= $2";
	query(sql, [bydate1, bydate2], function(err, results) {
		if (err) return callback(err);
		var atotal = Number(results.rows[0].ti) - Number(results.rows[0].to);
		callback(null, {atotal:atotal});
	});
}
exports.registerBonus = function(join_first, real_first, real_charge, callback) {
	query("DELETE FROM bonus_environment", [], function(err, result) {
		var sql = "INSERT INTO bonus_environment (join_first, real_first, real_charge) VALUES ($1, $2, $3)";
		query(sql, [join_first, real_first, real_charge], function(err, result) {
			if (err) return callback(err);
			callback(null, result);
		});
	});
}
exports.registerExchange = function(game_play, exchange_time, callback) {
	query("DELETE FROM exchange_environment", [], function(err, result) {
		var sql = "INSERT INTO exchange_environment (game_play, exchange_time) VALUES ($1, $2)";
		query(sql, [game_play, exchange_time], function(err, result) {
			if (err) return callback(err);
			callback(null, result);
		});
	});
}
exports.bonusEnvironment = function(callback) {
	var sql = "select * from bonus_environment";
	query(sql, [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows[0]);
	});
}
exports.exchangeEnvironment = function(callback) {
	var sql = "select * from exchange_environment";
	query(sql, [], function(err, result) {
		if (err) return callback(err);
		callback(null, result.rows[0]);
	});
}
exports.changePoint = function(uid, callback) {
	var sql = "UPDATE users SET balance_satoshis = balance_satoshis + point, point = point- point  WHERE id=$1";
	query(sql, [uid], function(err, result) {
		if (err) return callback(err);
		query("select balance_satoshis, point from users where id = $1", [uid], function(err, result) {
			if (err) return callback(err);
			callback(null, result.rows[0]);
		});
	});
}
