var assert = require('better-assert');
var async = require('async');
var db = require('./database');
var events = require('events');
var util = require('util');
var _ = require('lodash');
var lib = require('./lib');
var SortedArray = require('./sorted_array');
var config = require('./config');

var tickRate = 150; // ping the client every X miliseconds
var afterCrashTime = 3000; // how long from game_crash -> game_starting
var restartTime = 5000; // How long from  game_starting -> game_started
var autoVirCashOut = 300000;
var virUserList = new Array();
var rndUserList1 = new Array();
var rndUserList2 = new Array();
var rndUserList3 = new Array();
var rnd20 = new Array(100);
var arrayAt=new Array();

var index1 =0;
var index2 =0;
var countVal = 0;
var vlength1 = 0;
var vlength2 = 0;
var rndlength =0;

function Game(lastGameId, lastHash, bankroll, gameHistory) {
    var self = this;

    self.bankroll = bankroll;
    self.maxWin;

	self.offset = 0;

    self.gameShuttingDown = false;
    self.startTime; // time game started. If before game started, is an estimate...
    self.crashPoint; // when the game crashes, 0 means instant crash
    self.gameDuration; // how long till the game will crash..

    self.forcePoint = null; // The point we force terminate the game

    self.state = 'ENDED'; // 'STARTING' | 'BLOCKING' | 'IN_PROGRESS' |  'ENDED'
    self.pending = {}; // Set of players pending a joined
    self.pendingCount = 0;
    self.joined = new SortedArray(); // A list of joins, before the game is in progress

    self.players = {}; // An object of userName ->  { playId: ..., autoCashOut: .... }
    self.gameId = lastGameId;
    self.gameHistory = gameHistory;

    self.lastHash = lastHash;
    self.hash = null;
	self.gameno;
	
    events.EventEmitter.call(self);

    function runGame() {

        db.createGame(self.gameId + 1, function (err, info) {
            if (err) {
                console.log('Could not create game', err, ' retrying in 2 sec..');
                setTimeout(runGame, 2000);
                return;
            }

            self.state = 'STARTING';
            self.crashPoint = info.crashPoint;
			self.gameno = info.gameno;
			console.log(' \n\n Game STARTING ==================== \n\r');
            console.log('[DB CrashPoint]: ', self.crashPoint);
            if (config.CRASH_AT) {
                assert(!config.PRODUCTION);
                self.crashPoint = parseInt(config.CRASH_AT);
                console.log('[Conifg CrashPoint]: ', self.crashPoint);
            }

			self.maxWin = Math.round(self.bankroll * 0.03);
            console.log('[Payable BankRoll]: ', self.bankroll);
            console.log('[Payable MaxWin for 3%]: ', self.maxWin);

			db.maxmoney(function(err, result){
				if (err) {
					console.log('Could not get maxprofit', err, ' retrying in 2 sec..');
					setTimeout(runGame, 2000);
					return;
				}
				var maxvalue = result;
				maxvalue = maxvalue * 100;
                console.log('[db.maxmoney]: ', maxvalue);
				self.hash = info.hash;
				self.gameId++;
                console.log('self.gameId++: ', self.gameId);
				self.startTime = new Date(Date.now() + restartTime);
                console.log('[restartTime]: ', restartTime);
                console.log('[self.startTime = new Date(Date.now() + restartTime)]: ', self.startTime);
				self.players = {}; // An object of userName ->  { user: ..., playId: ..., autoCashOut: ...., status: ... }
				self.gameDuration = Math.ceil(inverseGrowth(self.crashPoint + 1)); // how long till the game will crash..
                console.log('[self.gameDuration = Math.ceil(inverseGrowth(self.crashPoint + 1))]: ', self.gameDuration);
                console.log('[self.offset]: ', self.offset);
				if(maxvalue != 0) {
                    self.maxWin = maxvalue - self.offset; // Risk 3% per game
                    console.log('[self.maxWin = maxvalue - self.offset]: ', self.maxWin);
                }

				self.emit('game_starting', {
					game_id: self.gameId,
					max_win: self.maxWin,
					time_till_start: restartTime
				});

				setTimeout(blockGame, restartTime);

				rndUserList3 = new Array();
			

				db.getVirUsers(function(err, results){
					var temp;
					var rnum;
					var ar = new Array();
					var ind = 0;
					if(!err){
						virUserList = new Array();
						rndUserList1 = new Array();
						results.forEach(function(virUser) {
							virUserList.push(virUser);
							ar.push(ind);					
							ind++;
						});
						for(var i=0; i< ar.length; i++)
						{
							rnum = Math.floor(Math.random() *ar.length); //�����߻�
							temp = ar[i];
							ar[i] = ar[rnum];
							ar[rnum] = temp;
						}
						for(var i=0; i< ar.length; i++){
							var j = ar[i];
							rndUserList1[i] =  virUserList[j];
						}
					}
					var max1 = rndUserList1.length;
					var min1 = Math.round(rndUserList1.length*0.6);
					rndlength = Math.random() * (max1 - min1) + min1;
					AutoGame();
				});
			});
		});
    }

	function AutoGame() {
		var restartRTime = Math.floor(Math.random() * (150 - 80) + 80);

		if(self.state != 'STARTING') {
			index1 = 0;
			return;
		}
		
		var balance;
		var maxBal;
		var minBal;
		var RandBal;
		
		var vir_user =  rndUserList1[index1];

		rndUserList3.push(vir_user);
		
			var balance = vir_user.virbetsize;
			maxBal = Number(balance);
			minBal = Number(balance)*0.5;
			RandBal = Math.random() * (maxBal - minBal) + minBal;
			if(minBal < 100000) {
				RandBal =  Number(Math.floor(RandBal) - (Math.floor(RandBal))%10000);
			}
			else if(minBal  >= 100000 && minBal < 5000000){
				RandBal =  Number(Math.floor(RandBal) - (Math.floor(RandBal))%100000);
			}
			else {
				RandBal =  Number(Math.floor(RandBal) - (Math.floor(RandBal))%1000000);
			}
			/*
			maxBal  = Number('100000');
			minBal  = Number('10000');

			RandBal = Math.floor(Math.random() * (maxBal - minBal) + minBal );
			RandBal = Number(RandBal - RandBal%1000);
			*/
			

			
			if( RandBal == 0)
			{	
				RandBal = 120000;
			}

			self.placeBet(vir_user, RandBal, autoVirCashOut, false, function(err){
				if(err){
					//console.log('err=', err);
				}
			});

		index1 ++;
		if(index1 >= rndlength) { index1 = 0; return;}

		setTimeout(AutoGame, restartRTime);
	}

    function blockGame() {
        self.state = 'BLOCKING'; // we're waiting for pending bets..

        loop();
        function loop() {
            if (self.pendingCount > 0) {
                console.log('Delaying game by 100ms for ', self.pendingCount , ' joins');
                return setTimeout(loop, 100);
            }
            startGame();
        }

    }

    function startGame() {
        self.state = 'IN_PROGRESS';
        self.startTime = new Date();
        self.pending = {};
        self.pendingCount = 0;

        var bets = {};
        var arr = self.joined.getArray();
        for (var i = 0; i < arr.length; ++i) {
            var a = arr[i];
            bets[a.user.username] = a.bet;
            self.players[a.user.username] = a;
        }

        self.joined.clear();

        self.emit('game_started', bets);

        self.setForcePoint();

        callTick(0);
		
		var temp;
		var rnum;
		var rnum1;
		var temp1;
		var ar = new Array();
		rndUserList2 = new Array();
		
		vlength2 = rndUserList3.length;
		
		if(countVal%20 == 0 || vlength1 != vlength2){
			rnd20 = new Array(rndUserList3.length);
			for(var i = 0; i< rndUserList3.length; i++){
				rnd20[i] = new Array(20);
				for(var j = 0; j < 20; j++){
					rnd20[i][j] = j;
				}
				for(var j=0; j< rnd20[i].length; j++)
				{
					rnum1 = Math.floor(Math.random() * 20);
					temp1 = rnd20[i][j];
					rnd20[i][j] = rnd20[i][rnum1];
					rnd20[i][rnum1] = temp1;
				}
			}
			vlength1 = rndUserList3.length;
		}

		for(var i= 0; i < rndUserList3.length; i++) {
					ar.push(i);					
		}
		for(var i=0; i< ar.length; i++)
		{
			rnum = Math.floor(Math.random() *ar.length); //�����߻�
			temp = ar[i];
			ar[i] = ar[rnum];
			ar[rnum] = temp;
		}
		for(var i=0; i< ar.length; i++){
			var j = ar[i];
			rndUserList2[i] =  rndUserList3[j];
		}
		countVal ++;
		arrayAt = new Array();
		for(var k=0; k<rndUserList2.length; k++){
			var viruser2 = rndUserList2[k];
			var tmp2 = Number(countVal%20);
			var compare = rnd20[k][tmp2];
			if(compare == 2 || compare == 3 || compare == 7 || compare == 10  || compare == 13 || compare == 16 || compare == 18)
			{
				var min = Number(viruser2.virbetval) - (Number(viruser2.virbetval) - 100 ) * 0.35; 
				var max = Number(viruser2.virbetval);
				arrayAt.push(Math.floor(Math.random() * (max -min) + min));
			}
			else {
				var min = 101;
				var max = Number(viruser2.virbetval) - (Number(viruser2.virbetval) - 100 ) * 0.35;
				arrayAt.push(Math.floor(Math.random() * (max -min) + min));
			}
		}
		AutoCashOut();
    }

	function AutoCashOut() {
		
		var maxTime =  Math.floor(self.crashPoint / 15)*10;

		var resCTime = Math.floor(Math.random() * (maxTime - 300) + 300);

		if(self.state != 'IN_PROGRESS') return;
		if(!rndUserList2[index2]) {

			index2 ++;

			if(index2 >= rndUserList2.length) { index2 = 0;}

			setTimeout(AutoCashOut, 10);

			return;
		}
		var virUser1 = rndUserList2[index2];
		var elapsed = new Date() - self.startTime;
		var at1 = growthFunc(elapsed);
		var at = arrayAt[index2];
		/*
		var tmp1 = Number(index2);
		var tmp2 = Number(countVal%20);
		var compare = Number(rnd20[tmp1][tmp2]);
		
		if(compare == 2 || compare == 3 || compare == 7 || compare == 10  || compare == 13 || compare == 16 || compare == 18)
		{
			var min = Number(virUser1.virbetval) - (Number(virUser1.virbetval) - 100 ) * 0.35; 
			var max = Number(virUser1.virbetval);
			at = Math.floor(Math.random() * (max -min) + min);
		}
		else {
			var min = 101;
			var max = Number(virUser1.virbetval) - (Number(virUser1.virbetval) - 100 ) * 0.35;
			at = Math.floor(Math.random() * (max -min) + min);
		}
		*/
		if(at1 < at ) {
			index2 ++;
		
			if(index2 >= rndUserList2.length) { index2 = 0;}

			setTimeout(AutoCashOut, 10);
			
			return;
		} 
		var play = lib.getOwnProperty(self.players, virUser1.username);

		if (!play) {
			index2 ++;
		
			if(index2 >= rndUserList2.length) { index2 = 0;}

			setTimeout(AutoCashOut, 10);
			return;
		}
		
		/*if (play.autoCashOut <= at)
			at = play.autoCashOut;

		if (self.forcePoint <= at)
			at = self.forcePoint;*/

		if (at1 > self.crashPoint) return; 
		

		if (play.status === 'CASHED_OUT') {
			index2 ++;
		
			if(index2 >= rndUserList2.length) { index2 = 0;}

			setTimeout(AutoCashOut, 10);
			return;
		}

		var username = play.user.username;

		self.players[username].status = 'CASHED_OUT';
		self.players[username].stoppedAt = at;

		var won = (self.players[username].bet / 100) * at;

		self.emit('cashed_out', {
			username: username,
			stopped_at: at
		});
		
		db.cashOut(play.user.id, play.playId, won, function(err) {
			if (err) {
				console.log('[INTERNAL_ERROR] could not cash out: ', username, ' at ', at, ' in ', play, ' because: ', err);
				return;
			}
		});

		index2 ++;
		
		if(index2 >= rndUserList2.length) { index2 = 0;}

		setTimeout(AutoCashOut, 10);
	}

    function callTick(elapsed) {
        //console.log('callTick(elapsed)', elapsed);
        var left = self.gameDuration - elapsed;
        //console.log('self.gameDuration', self.gameDuration);
        //console.log('var left = self.gameDuration - elapsed;: ', left);
        var nextTick = Math.max(0, Math.min(left, tickRate));
        //console.log('var nextTick = Math.max(0, Math.min(left, tickRate)): ', nextTick);
        setTimeout(runTick, nextTick);
    }


    function runTick() {

        var elapsed = new Date() - self.startTime;
        //console.log('var elapsed = new Date() - self.startTime: ', elapsed);
        var at = growthFunc(elapsed);
        //console.log('var at = growthFunc(elapsed): ', at);
        self.runCashOuts(at);
        //console.log('self.forcePoint: ', self.forcePoint);
        //console.log('self.crashPoint: ', self.crashPoint);
        if (self.forcePoint <= at && self.forcePoint <= self.crashPoint) {
            self.cashOutAll(self.forcePoint, function (err) {
                console.log('Just forced cashed out everyone at: ', self.forcePoint, ' got err: ', err);

                endGame(true);
            });
            return;
        }

        // and run the next

        if (at > self.crashPoint)
            endGame(false); // oh noes, we crashed!
        else
            tick(elapsed);
    }

    function endGame(forced) {
        var gameId = self.gameId;
        var crashTime = Date.now();
        assert(self.crashPoint == 0 || self.crashPoint >= 100);

        var bonuses = [];

        if (self.crashPoint !== 0) {
            bonuses = calcBonuses(self.players);

            var givenOut = 0;
            Object.keys(self.players).forEach(function(player) {
                var record = self.players[player];

                givenOut += record.bet * 0.01;
                if (record.status === 'CASHED_OUT') {
                    var given = record.stoppedAt * (record.bet / 100);
                   // assert(lib.isInt(given) && given > 0);
                    givenOut += given;
                }
            });

            self.bankroll -= givenOut;
			self.offset = givenOut;
            console.log('endGame/givenOut', givenOut);
			console.log('endGame/self.bankroll', self.bankroll);
            console.log('endGame/self.offset', self.offset);
        }

        var playerInfo = self.getInfo().player_info;
        var bonusJson = {};
        bonuses.forEach(function(entry) {
            bonusJson[entry.user.username] = entry.amount;
            playerInfo[entry.user.username].bonus = entry.amount;
        });

        self.lastHash = self.hash;

        // oh noes, we crashed!
        self.emit('game_crash', {
            forced: forced,
            elapsed: self.gameDuration,
            game_crash: self.crashPoint, // We send 0 to client in instant crash
            bonuses: bonusJson,
			game_no: self.gameno,
            hash: self.lastHash
        });
        self.gameHistory.addCompletedGame({
            game_id: gameId,
            game_crash: self.crashPoint,
            created: self.startTime,
			game_no: self.gameno,
            player_info: playerInfo,
            hash: self.lastHash
        });
        var dbTimer;
        dbTimeout();
        function dbTimeout() {
            dbTimer = setTimeout(function() {
                console.log('Game', gameId, 'is still ending... Time since crash:',
                            ((Date.now() - crashTime)/1000).toFixed(3) + 's');
                dbTimeout();
            }, 1000);
        }

        db.endGame(gameId, bonuses, function(err) {
            if (err)
                console.log('ERROR could not end game id: ', gameId, ' got err: ', err);
            clearTimeout(dbTimer);

            if (self.gameShuttingDown)
                self.emit('shutdown');
            else
                setTimeout(runGame, (crashTime + afterCrashTime) - Date.now());
        });

        self.state = 'ENDED';
		//add by lt
		rndUserList3 = new Array();
    }

    function tick(elapsed) {
        self.emit('game_tick', elapsed);
        callTick(elapsed);
    }

    runGame();
}

util.inherits(Game, events.EventEmitter);

Game.prototype.getInfo = function() {

    var playerInfo = {};

    for (var username in this.players) {
        var record = this.players[username];

        assert(lib.isInt(record.bet));
        var info = {
            bet: record.bet
        };

        if (record.status === 'CASHED_OUT') {
            assert(lib.isInt(record.stoppedAt));
            info['stopped_at'] = record.stoppedAt;
        }

        playerInfo[username] = info;
    }
    var res = {
        state: this.state,
        player_info: playerInfo,
        game_id: this.gameId, // game_id of current game, if game hasnt' started its the last game
        last_hash: this.lastHash,
        max_win: this.maxWin,
        // if the game is pending, elapsed is how long till it starts
        // if the game is running, elapsed is how long its running for
        /// if the game is ended, elapsed is how long since the game started
        elapsed: Date.now() - this.startTime,
        created: this.startTime,
        joined: this.joined.getArray().map(function(u) { return u.user.username; })
    };
    if (this.state === 'ENDED')
        res.crashed_at = this.crashPoint;


    return res;
};

// Calls callback with (err, booleanIfAbleToJoin)
// Modified by jjb 2017.10.24. Added a parameter autoCashOutChk.
Game.prototype.placeBet = function(user, betAmount, autoCashOut, autoCashOutChk, callback) {
    var self = this;
    
    assert(typeof user.id === 'number');
    assert(typeof user.username === 'string');
    assert(lib.isInt(betAmount));
    assert(lib.isInt(autoCashOut) && autoCashOut >= 100);

    if (self.state !== 'STARTING')
        return callback('GAME_IN_PROGRESS');

    if (lib.hasOwnProperty(self.pending, user.username) || lib.hasOwnProperty(self.players, user.username))
        return callback('ALREADY_PLACED_BET');

    self.pending[user.username] = user.username;
    self.pendingCount++;

    db.placeBet(betAmount, autoCashOut, user.id, self.gameId, function(err, playId) {
        self.pendingCount--;

        if (err) {
            if (err.code == '23514') // constraint violation
                return callback('NOT_ENOUGH_MONEY');

            console.log('[INTERNAL_ERROR] could not play game, got error: ', err);
            callback(err);
        } else {
            assert(playId > 0);

            self.bankroll += betAmount;
            // Modified by jjb 2017.10.24. Added autoCashOutChk.
            var index = self.joined.insert({ user: user, bet: betAmount, autoCashOut: autoCashOut, playId: playId, status: 'PLAYING', autoCashOutChk: autoCashOutChk});

            self.emit('player_bet',  {
                username: user.username,
                index: index
            });

            callback(null);
        }
    });
};


Game.prototype.doCashOut = function(play, at, callback) {
    assert(typeof play.user.username === 'string');
    assert(typeof play.user.id == 'number');
    assert(typeof play.playId == 'number');
    assert(typeof at === 'number');
    assert(typeof callback === 'function');

    var self = this;

    var username = play.user.username;

    assert(self.players[username].status === 'PLAYING');
    self.players[username].status = 'CASHED_OUT';
    self.players[username].stoppedAt = at;

    var won = (self.players[username].bet / 100) * at;
    assert(lib.isInt(won));

    self.emit('cashed_out', {
        username: username,
        stopped_at: at
    });

    db.cashOut(play.user.id, play.playId, won, function(err) {
        if (err) {
            console.log('[INTERNAL_ERROR] could not cash out: ', username, ' at ', at, ' in ', play, ' because: ', err);
            return callback(err);
        }

        callback(null);
    });
};

Game.prototype.runCashOuts = function(at) {
    var self = this;

    var update = false;
    // Check for auto cashouts

    Object.keys(self.players).forEach(function (playerUserName) {
        var play = self.players[playerUserName];

        if (play.status === 'CASHED_OUT')
            return;

        assert(play.status === 'PLAYING');
        assert(play.autoCashOut);
        
        //console.log('Game.prototype.playerUserName', playerUserName);
        //console.log('Game.prototype.runCashOuts', play.autoCashOutChk);
        
        if (play.autoCashOut <= at && play.autoCashOut <= self.crashPoint && play.autoCashOut <= self.forcePoint) {
            if(play.autoCashOutChk == false){ // Modified by jjb 2017.10.24. Added the condition as 'if'
                self.doCashOut(play, play.autoCashOut, function (err) {
                    if (err)
                        console.log('[INTERNAL_ERROR] could not auto cashout ', playerUserName, ' at ', play.autoCashOut);
                });
            }
            update = true;
        }
    });

    if (update)
        self.setForcePoint();
};

Game.prototype.setForcePoint = function() {
   var self = this;

   var totalBet = 0; // how much satoshis is still in action
   var totalCashedOut = 0; // how much satoshis has been lost

   Object.keys(self.players).forEach(function(playerName) {
       var play = self.players[playerName];

       if (play.status === 'CASHED_OUT') {
           var amount = play.bet * (play.stoppedAt - 100) / 100;
           totalCashedOut += amount;
       } else {
           assert(play.status == 'PLAYING');
           assert(lib.isInt(play.bet));
           totalBet += play.bet;
       }
   });
   if (totalBet === 0) {
       self.forcePoint = Infinity; // the game can go until it crashes, there's no end.
   } else {
       var left = self.maxWin - totalCashedOut - (totalBet * 0.01);

       var ratio =  (left+totalBet) / totalBet;

       // in percent
       self.forcePoint = Math.max(Math.floor(ratio * 100), 101);
   }

};

Game.prototype.cashOut = function(user, callback) {
    var self = this;

    assert(typeof user.id === 'number');

    if (this.state !== 'IN_PROGRESS')
        return callback('GAME_NOT_IN_PROGRESS');

    var elapsed = new Date() - self.startTime;
    var at = growthFunc(elapsed);
    var play = lib.getOwnProperty(self.players, user.username);

    if (!play)
        return callback('NO_BET_PLACED');
    // Modified by jjb 2017.10.24. Added condition 'play.autoCashOutChk == false'
    if (play.autoCashOut <= at && play.autoCashOutChk == false)
        at = play.autoCashOut;

    if (self.forcePoint <= at)
        at = self.forcePoint;


    if (at > self.crashPoint)
        return callback('GAME_ALREADY_CRASHED');

    if (play.status === 'CASHED_OUT')
        return callback('ALREADY_CASHED_OUT');
    console.log('self.at', at);
    // if(play.autoCashOutChk == true) at = self.forcePoint;
    self.doCashOut(play, at, callback);
    self.setForcePoint();
};

Game.prototype.cashOutAll = function(at, callback) {
    var self = this;

    if (this.state !== 'IN_PROGRESS')
        return callback();

    console.log('Cashing everyone out at: ', at);

    assert(at >= 100);

    self.runCashOuts(at);

    if (at > self.crashPoint)
        return callback(); // game already crashed, sorry guys

    var tasks = [];

    Object.keys(self.players).forEach(function(playerName) {
        var play = self.players[playerName];

        if (play.status === 'PLAYING') {
            tasks.push(function (callback) {
                if (play.status === 'PLAYING')
                    self.doCashOut(play, at, callback);
                else
                    callback();
            });
        }
    });

    console.log('Needing to force cash out: ', tasks.length, ' players');

    async.parallelLimit(tasks, 4, function (err) {
        if (err) {
            console.error('[INTERNAL_ERROR] unable to cash out all players in ', self.gameId, ' at ', at);
            callback(err);
            return;
        }
        console.log('Emergency cashed out all players in gameId: ', self.gameId);

        callback();
    });
};

Game.prototype.shutDown = function() {
    var self = this;

    self.gameShuttingDown = true;
    self.emit('shuttingdown');

    // If the game has already ended, we can shutdown immediately.
    if (this.state === 'ENDED') {
        self.emit('shutdown');
    }
};

/// returns [ {playId: ?, user: ?, amount: ? }, ...]
function calcBonuses(input) {
    // first, lets sum the bets..

    function sortCashOuts(input) {
        function r(c) {
            return c.stoppedAt ? -c.stoppedAt : null;
        }

        return _.sortBy(input, r);
    }

    // slides fn across array, providing [listRecords, stoppedAt, totalBetAmount]
    function slideSameStoppedAt(arr, fn) {
        var i = 0;
        while (i < arr.length) {
            var tmp = [];
            var betAmount = 0;
            var sa = arr[i].stoppedAt;
            for (; i < arr.length && arr[i].stoppedAt === sa; ++i) {
                betAmount += arr[i].bet;
                tmp.push(arr[i]);
            }
            assert(tmp.length >= 1);
            fn(tmp, sa, betAmount);
        }
    }

    var results = [];

    var sorted = sortCashOuts(input);

    if (sorted.length  === 0)
        return results;

    var bonusPool = 0;
    var largestBet = 0;

    for (var i = 0; i < sorted.length; ++i) {
        var record = sorted[i];

        assert(record.status === 'CASHED_OUT' || record.status === 'PLAYING');
        assert(record.playId);
        var bet = record.bet;
        assert(lib.isInt(bet));

        bonusPool += bet / 100;
		assert(lib.isInt(bonusPool));

        largestBet = Math.max(largestBet, bet);
    }

    var maxWinRatio = bonusPool / largestBet;

    slideSameStoppedAt(sorted,
        function(listOfRecords, cashOutAmount, totalBetAmount) {
            if (bonusPool <= 0)
                return;

            var toAllocAll = Math.min(totalBetAmount * maxWinRatio, bonusPool);

            for (var i = 0; i < listOfRecords.length; ++i) {
                var toAlloc = Math.round((listOfRecords[i].bet / totalBetAmount) * toAllocAll);

                if (toAlloc <= 0)
                    continue;

                bonusPool -= toAlloc;

                var playId = listOfRecords[i].playId;
                assert(lib.isInt(playId));
                var user = listOfRecords[i].user;
                assert(user);

                results.push({
                    playId: playId,
                    user: user,
                    amount: toAlloc
                });
            }
        }
    );

    return results;
}


function growthFunc(ms) {
    var r = 0.00006;
    return Math.floor(100 * Math.pow(Math.E, r * ms));
}

function inverseGrowth(result) {
    var c = 16666.666667;
    return c * Math.log(0.01 * result);
}

module.exports = Game;
