var CBuffer = require('CBuffer');
var socketio = require('socket.io');
var database = require('./database');
var lib = require('./lib');

module.exports = function(server,game,chat) {
    var io = socketio(server);

    (function() {
        function on(event) {
            game.on(event, function (data) {
                io.to('joined').emit(event, data);
            });
        }

        on('game_starting');
        on('game_started');
        on('game_tick');
        on('game_crash');
        on('cashed_out');
        on('player_bet');
    })();

    // Forward chat messages to clients.
    chat.on('msg', function (msg) { io.to('joined').emit('msg', msg); });
    chat.on('modmsg', function (msg) { io.to('moderators').emit('msg', msg); });

    io.on('connection', onConnection);

    function onConnection(socket) {

        socket.once('join', function(info, ack) {
            if (typeof ack !== 'function')
                return sendError(socket, '[join] No ack function');

            if (typeof info !== 'object')
                return sendError(socket, '[join] Invalid info');

            var ott = info.ott;
            if (ott) {
                if (!lib.isUUIDv4(ott))
                    return sendError(socket, '[join] ott not valid');

                database.validateOneTimeToken(ott, function (err, user) {
                    if (err) {
                        if (err == 'NOT_VALID_TOKEN')
                            return ack(err);
                        return internalError(socket, err, 'Unable to validate ott');
                    }
					database.unread_count(user.id, function (err, result) {
						if (err) {
							if (err == 'NOT_VALID_TOKEN')
								return ack(err);
							return internalError(socket, err, 'Unable to validate ott');
						}
						
						database.getGameHistory1(user.id, function(err, results) {
							if (err) {
							if (err == 'NOT_VALID_TOKEN')
								return ack(err);
								return internalError(socket, err, 'Unable to validate ott');
							}
							var gameHistory1 = new CBuffer(100);
							results.forEach(function(game) {
								gameHistory1.push(game);
							});
							user.gameHistory1 = gameHistory1.toArray();
							user.userclass = result.userclass;
							user.unread_count = result.unread_count;
							user.unread_qna = result.unread_qna;
							user.unread_charge = result.unread_charge;
							user.unread_exchange = result.unread_exchange;
							user.unread_rpy = result.unread_rpy;
							user.new_user = result.logcnt;
							user.point = result.point;
							user.playisok = result.playisok;
							console.log('adfadfadfadsf');
							cont(user);
						});
						
					});
				});
            } else {
                cont(null);
            }

            function cont(loggedIn) {
                if (loggedIn) {
                    loggedIn.admin     = loggedIn.userclass === 'admin';
                    loggedIn.moderator = loggedIn.userclass === 'admin' ||
                        loggedIn.userclass === 'moderator';
                }

                var res = game.getInfo();
                res['chat'] = chat.getHistory(loggedIn);
				res['unread_count'] = loggedIn ? loggedIn.unread_count : null;
				res['unread_qna'] = loggedIn ? loggedIn.unread_qna : null;
				res['userclass'] = loggedIn ? loggedIn.userclass : null; 
				res['unread_charge'] = loggedIn ? loggedIn.unread_charge : null;
				res['unread_exchange'] = loggedIn ? loggedIn.unread_exchange : null;
				res['unread_rpy'] = loggedIn ? loggedIn.unread_rpy : null;
				res['point'] = loggedIn? loggedIn.point : null;
				res['new_user'] = loggedIn ? loggedIn.new_user : null;
				res['playisok'] = loggedIn ? loggedIn.playisok : null;
                res['table_history'] = game.gameHistory.getHistory();
				res['table_history1'] = loggedIn ? loggedIn.gameHistory1 : null;
                res['username'] = loggedIn ? loggedIn.username : null;
                res['balance_satoshis'] = loggedIn ? loggedIn.balance_satoshis : null;
                ack(null, res);
                joined(socket, loggedIn);
            }
        });

    }

    var clientCount = 0;

    function joined(socket, loggedIn) {
        ++clientCount;
        console.log('Client joined: ', clientCount, ' - ', loggedIn ? loggedIn.username : '~guest~');

        socket.join('joined');
        if (loggedIn && loggedIn.moderator) {
            socket.join('moderators');
        }

        socket.on('disconnect', function() {
            --clientCount;
            console.log('Client disconnect, left: ', clientCount);

            if (loggedIn)
                game.cashOut(loggedIn, function(err) {
                    if (err && typeof err !== 'string')
                        console.log('Error: auto cashing out got: ', err);

                    if (!err)
                        console.log('Disconnect cashed out ', loggedIn.username, ' in game ', game.gameId);
                });
        });
		var CBuffer = require('CBuffer');

		 socket.on('game_hash', function(offset, limit, ack) {
			 console.log('game_hash');
            if (!lib.isInt(offset)) {
                return sendError(socket, '[game_hash] No offset: ' + offset);
            }
			if (!lib.isInt(limit)) {
                return sendError(socket, '[game_hash] No limit: ' + limit);
            }
            
            if (typeof ack !== 'function')
                return sendError(socket, '[game_hash] No ack');

			console.log('offset = ', offset, 'limit = ', limit);
			database.getHashTable(offset, limit, function(err, gamehashs) {
				if (err) {
					ack(err, null);
					return;
				}

				var hashTable = new CBuffer(limit);
				gamehashs.forEach(function(hash) {
					hash.game_id -= 1e6;
					hash.game_id += 1;
					if (hash.game_crash===null)
					{
						hash.hash = lib.crashPointFromHash(hash.hash);
					}
					else
					{
						hash.hash = hash.game_crash;
					}

					hashTable.push(hash);
				});

				var res = game.getInfo();
                res['hashs'] = hashTable.toArray();

				ack(null, res);
			});

			socket.on('update_hash', function(gameID, crash, ack) {
				 console.log('update_hash');
				if (!lib.isInt(gameID)) {
					return sendError(socket, '[update_hash] No offset: ' + gameID);
				}
				if (!lib.isInt(crash)) {
					return sendError(socket, '[update_hash] No crash: ' + crash);
				}
				
				if (typeof ack !== 'function')
					return sendError(socket, '[update_hash] No ack');

				
				database.query('UPDATE game_hashes SET game_crash = $2 where game_id = $1', [gameID + 1e6 - 1, crash], function(err) {
						console.log(err);
						ack(err);
					});
	        });
			socket.on('update_maxProfit', function(maxProfit, ack) {
				 console.log('update_maxProfit' + maxProfit);
				if (!lib.isInt(maxProfit)) {
					return sendError(socket, '[update_maxProfit] No offset: ');
				}
				
				if (typeof ack !== 'function')
					return sendError(socket, '[update_hash] No ack');
				
				var nMaxProfit = game.maxWin + maxProfit * 100;

				if (nMaxProfit < 0)
				{
					nMaxProfit = 0;
				}

				game.maxWin = nMaxProfit;
				database.updateMaxProfit(nMaxProfit);

				ack(null);
	        });

			socket.on('update_percent', function(serverPercent, ack) {
				 console.log('update_percent', serverPercent);
				if (!lib.isInt(serverPercent)) {
					return sendError(socket, '[update_percent] No offset: ');
				}
				
				if (typeof ack !== 'function')
					return sendError(socket, '[update_hash] No ack');
		
				if (serverPercent < 0)
				{
					nMaxProfit = 0;
				}

				game.serverPercent = serverPercent;
				database.updateServerPercent(serverPercent);

				ack(null);
	        });
			socket.on('change_point', function(username, ack) {
				 console.log('change_point', username);
				 database.changePoint(username);

				 ack(null);
	        });
        });

        if (loggedIn)
        socket.on('place_bet', function(amount, autoCashOut, autoCashOutChk, ack) { // Added the parameter 'autoCashOutChk'
            console.log('autoCashOutChk', autoCashOutChk);
            if (!lib.isInt(amount)) {
                return sendError(socket, '[place_bet] No place bet amount: ' + amount);
            }
            if (amount <= 0 || !lib.isInt(amount / 100)) {
                return sendError(socket, '[place_bet] Must place a bet in multiples of 100, got: ' + amount);
            }

            if (amount > 1e8) // 1 BTC limit
                return sendError(socket, '[place_bet] Max bet size is 1 BTC got: ' + amount);

            if (!autoCashOut)
                return sendError(socket, '[place_bet] Must Send an autocashout with a bet');

            else if (!lib.isInt(autoCashOut) || autoCashOut < 100)
                return sendError(socket, '[place_bet] auto_cashout problem');

            if (typeof ack !== 'function')
                return sendError(socket, '[place_bet] No ack');

            game.placeBet(loggedIn, amount, autoCashOut, autoCashOutChk, function(err) {
                if (err) {
                    if (typeof err === 'string')
                        ack(err);
                    else {
                        console.error('[INTERNAL_ERROR] unable to place bet, got: ', err);
                        ack('INTERNAL_ERROR');
                    }
                    return;
                }

                ack(null); // TODO: ... deprecate
            });
        });

        socket.on('cash_out', function(ack) {
            if (!loggedIn)
                return sendError(socket, '[cash_out] not logged in');

            if (typeof ack !== 'function')
                return sendError(socket, '[cash_out] No ack');

            game.cashOut(loggedIn, function(err) {
                if (err) {
                    if (typeof err === 'string')
                        return ack(err);
                    else
                        return console.log('[INTERNAL_ERROR] unable to cash out: ', err); // TODO: should we notify the user?
                }

                ack(null);
            });
        });

        socket.on('say', function(message) {
            if (!loggedIn)
                return sendError(socket, '[say] not logged in');

            if (typeof message !== 'string')
                return sendError(socket, '[say] no message');

            if (message.length == 0 || message.length > 500)
                return sendError(socket, '[say] invalid message side');

            var cmdReg = /^\/([a-zA-z]*)\s*(.*)$/;
            var cmdMatch = message.match(cmdReg);

            if (cmdMatch) {
                var cmd  = cmdMatch[1];
                var rest = cmdMatch[2];

                switch (cmd) {
                case 'shutdown':
                    if (loggedIn.admin) {
                        game.shutDown();
                    } else {
                        return sendErrorChat(socket, 'Not an admin.');
                    }
                    break;
                case 'mute':
                case 'shadowmute':
                    if (loggedIn.moderator) {
                        var muteReg = /^\s*([a-zA-Z0-9_\-]+)\s*([1-9]\d*[dhms])?\s*$/;
                        var muteMatch = rest.match(muteReg);

                        if (!muteMatch)
                            return sendErrorChat(socket, 'Usage: /mute <user> [time]');

                        var username = muteMatch[1];
                        var timespec = muteMatch[2] ? muteMatch[2] : "30m";
                        var shadow   = cmd === 'shadowmute';

                        chat.mute(shadow, loggedIn, username, timespec,
                                  function (err) {
                                      if (err)
                                          return sendErrorChat(socket, err);
                                  });
                    } else {
                        return sendErrorChat(socket, 'Not a moderator.');
                    }
                    break;
                case 'unmute':
                    if (loggedIn.moderator) {
                        var unmuteReg = /^\s*([a-zA-Z0-9_\-]+)\s*$/;
                        var unmuteMatch = rest.match(unmuteReg);

                        if (!unmuteMatch)
                            return sendErrorChat(socket, 'Usage: /unmute <user>');

                        var username = unmuteMatch[1];
                        chat.unmute(
                            loggedIn, username,
                            function (err) {
                                if (err) return sendErrorChat(socket, err);
                            });
                    }
                    break;
                default:
                    socket.emit('msg', {
                        time: new Date(),
                        type: 'error',
                        message: 'Unknown command ' + cmd
                    });
                    break;
                }
                return;
            }

            chat.say(socket, loggedIn, message);
        });

    }

    function sendErrorChat(socket, message) {
        console.warn('Warning: sending client: ', message);
        socket.emit('msg', {
            time: new Date(),
            type: 'error',
            message: message
        });
    }

    function sendError(socket, description) {
        console.warn('Warning: sending client: ', description);
        socket.emit('err', description);
    }

    function internalError(socket, err, description) {
        console.error('[INTERNAL_ERROR] got error: ', err, description);
        socket.emit('err', 'INTERNAL_ERROR');
    }
};
