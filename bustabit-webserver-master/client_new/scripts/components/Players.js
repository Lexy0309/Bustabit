define([
    'react',
    'game-logic/clib',
    'lodash',
    'game-logic/engine',
    'classnames'
], function(
    React,
    Clib,
    _,
    Engine,
    CX
){

    var D = React.DOM;

    var popupList = [];

    function calcProfit(bet, stoppedAt) {
        return ((stoppedAt - 100) * bet)/100;
    }

    function getState(){
        return {
            engine: Engine
        }
    }
    var popIndex = 0;
	var timer;
	const successLimit = 10;
    var showedList = [];

	function insertPoplist(user, pointAt, profit){
	    if(pointAt/100 > successLimit){
            popupList.push({username: user, pointAt: pointAt, profit: profit});
        }
    }
    function createPop(){
		var items = popupList;
        var ttt = items.map(function(item, i){
            var title = '<font color="#752e0c" size="3pt"><b>' + item.username + '</b></font>님';
			var message = '<font color="#752222" size="3pt"><b>' + item.pointAt + 'x</b></font>당첨<br>순수익 <b><font color="#752222" size="3pt">' + item.profit + '</b></font>원획득하셨습니다.<br>축하드립니다.';
            if(popIndex > 4) setTimeout(createNotify, 1500*i, title, message);
            else setTimeout(createNotify, 500*i, title, message);
        });
    }
    var sh = 0;
    function hidePop(my){
        if(my){
            sh++;
            setTimeout(my.reset(), 3000*sh);
        }
    }
    function createNotify(title, msg){
        //var old = showedList.shift();
        //hidePop(old);
        var mytoast = $.toast({
            heading: title,
            text: msg,
            showHideTransition: 'slide',
            icon: 'info',
            hideAfter: 3000,
            position: 'bottom-right',
            beforeShow: function () {
            },
            afterShown: function () {
            },
            beforeHide: function () {
            },
            afterHidden: function () {
            }
        });
        popIndex++;
        showedList.push(mytoast);
    }
    function resetAll(){
        showedList = [];
        popupList = [];
        //setTimeout(function(){$.toast().reset('all')}, 5000);
    }
    return React.createClass({
        displayName: 'usersPlaying',

        getInitialState: function () {
            return getState();
        },

        componentDidMount: function() {
            Engine.on({
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
			createPop(this.state.pop);
        },

        componentWillUnmount: function() {
            Engine.off({
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange
            });
        },

        _onChange: function() {
            if(this.isMounted())
                this.setState(getState());
        },

        render: function() {
            var self = this;

            var usersWonCashed = [];
            var usersLostPlaying = [];

            var trUsersWonCashed;
            var trUsersLostPlaying;

            var tBody;

            var game = self.state.engine;

            resetAll();
            // console.log(game.gameState);
            /** Separate and sort the users depending on the game state **/
            if (game.gameState === 'STARTING') {
                //The list is already ordered by engine given an index

                usersLostPlaying = self.state.engine.joined.map(function(player) {
                    var bet; // can be undefined

                    if (player === self.state.engine.username)
                        bet = self.state.engine.nextBetAmount;

                    return { username: player, bet: bet };
                });
            } else {
                _.forEach(game.playerInfo, function (player, username) {

                    if (player.stopped_at)
                        usersWonCashed.push(player);
                    else
                        usersLostPlaying.push(player);
                });

                usersWonCashed.sort(function(a, b) {
                    var r = b.stopped_at - a.stopped_at;
                    if (r !== 0) return r;
                    return a.username < b.username ? 1 : -1;
                });

                usersLostPlaying.sort(function(a, b) {
                    var r = b.bet - a.bet;
                    if (r !== 0) return r;
                    return a.username < b.username ? 1 : -1;
                });

            }

            /** Create the rows for the table **/

            //Users Playing and users cashed
            if(game.gameState === 'IN_PROGRESS' || game.gameState === 'STARTING') {
                var i, length;
                var bonusClass = (game.gameState === 'IN_PROGRESS')? 'bonus-projection' : '';

                trUsersLostPlaying = [];
                for(i=0, length = usersLostPlaying.length; i < length; i++) {

                    var user = usersLostPlaying[i];
                    var bonus = (game.gameState === 'IN_PROGRESS')? ( (user.bonus)? Clib.formatDecimals((user.bonus*100/user.bet), 2) + '%': '0%' ) : '-';
                    var classes = CX({
                        'user-playing': true,
                        'me': self.state.engine.username === user.username
                    });

                    trUsersLostPlaying.push( D.tr({ className: classes, key: 'user' + i },
                        D.td(null, D.a({ href: '/user/' + user.username,
                                target: '_blank'
                            },
                            user.username)),
                        D.td(null, '-'),
                        D.td(null,
                            user.bet ? Clib.formatSatoshis(user.bet, 0) : '?'
                        ),
                        D.td({ className: bonusClass }, bonus),
                        D.td(null, '-')
                    ));

                }

                trUsersWonCashed = [];
                popIndex = 0;
                for (i=0, length = usersWonCashed.length; i < length; i++) {

                    var user = usersWonCashed[i];
                    var profit = calcProfit(user.bet, user.stopped_at);
                    var bonus = (game.gameState === 'IN_PROGRESS')? ( (user.bonus)? Clib.formatDecimals((user.bonus*100/user.bet), 2) + '%': '0%' ) : '-';
                    var classes = CX({
                        'user-cashed': true,
                        'me': self.state.engine.username === user.username
                    });
                    trUsersWonCashed.push( D.tr({ className: classes, key: 'user' + i },
                        D.td(null, D.a({ href: '/user/' + user.username,
                                target: '_blank'
                            },
                            user.username)),
                        D.td(null, user.stopped_at/100 + 'x'),
                        D.td(null, Clib.formatSatoshis(user.bet, 0)),
                        D.td({ className: bonusClass }, bonus),
                        D.td(null, Clib.formatSatoshis(profit, 0))
                    ));
                    /*
                    insertPoplist(user.username, user.stopped_at, Clib.formatSatoshis(profit, 0)); // Constructs popup list!
                    */
                }

                tBody = D.tbody({ className: '' },
                    trUsersLostPlaying,
                    trUsersWonCashed
                );

                //Users Lost and users Won
            } else if(game.gameState === 'ENDED') {

                trUsersLostPlaying = usersLostPlaying.map(function(entry, i) {
                    var bet = entry.bet;
                    var bonus = entry.bonus;
                    var profit = -bet;

                    if (bonus) {
                        profit = Clib.formatSatoshis(profit + bonus, 0);
                        bonus = Clib.formatDecimals(bonus*100/bet, 2)+'%';
                    } else {
                        profit = Clib.formatSatoshis(profit,0);
                        bonus = '0%';
                    }

                    var classes = CX({
                        'user-lost': true,
                        'me': self.state.engine.username === entry.username
                    });

                    return D.tr({ className: classes, key: 'user' + i },
                        D.td(null, D.a({ href: '/user/' + entry.username,
                                target: '_blank'
                            },
                            entry.username)),
                        D.td(null, '-'),
                        D.td(null, Clib.formatSatoshis(entry.bet, 0)),
                        D.td(null, bonus),
                        D.td(null, profit)
                    );
                });

                trUsersWonCashed = usersWonCashed.map(function(entry, i) {
                    var bet = entry.bet;
                    var bonus = entry.bonus;
                    var stopped = entry.stopped_at;
                    var profit = bet * (stopped - 100) / 100;

                    if (bonus) {
                        profit = Clib.formatSatoshis(profit + bonus, 0);
						bonus = Clib.formatDecimals(bonus*100/bet, 2)+'%';
                    } else {
                        profit = Clib.formatSatoshis(profit, 0);
						
                        bonus = '0%';
                    }

                    insertPoplist(entry.username, stopped, profit); // Constructs popup list!

                    var classes = CX({
                        'user-won': true,
                        'me': self.state.engine.username === entry.username
                    });

                    return D.tr(
                        { className: classes, key: 'user' + i },
                        D.td(null, D.a({
                                href: '/user/' + entry.username,
                                target: '_blank'
                            },
                            entry.username)),
                        D.td(null, stopped / 100, 'x'),
                        D.td(null, Clib.formatSatoshis(bet, 0)),
                        D.td(null, bonus),
                        D.td(null, profit)
                    );
                });

                createPop();
				
                tBody = D.tbody({ className: '' },
                    trUsersLostPlaying,
                    trUsersWonCashed
                );
            }

            return D.div({ id: 'players-container' },
                D.div({ className: 'header-bg' }),
                D.div({ className: 'table-inner' },
                D.table({ className: 'users-playing' },
                    D.thead(null,
                        D.tr(null,
                            D.th(null, D.div({ className: 'th-inner' }, '유저')),
                            D.th(null, D.div({ className: 'th-inner' }, '수익률')),
                            D.th(null, D.div({ className: 'th-inner' }, '배팅금')),
                            D.th(null, D.div({ className: 'th-inner' }, '보너스')),
                            D.th(null, D.div({ className: 'th-inner' }, '순수익'))
                        )
                    ),
                    tBody
                )
            )
            );
        }

    });

});