define([
    'react',
    'game-logic/clib',
    'game-logic/engine'
], function(
    React,
    Clib,
    Engine
){

    /** Constants **/
    var MAX_GAMES_SHOWED = 50;

    var D = React.DOM;

    function getState(){
        return {
            engine: Engine
        }
    }

    function copyHash(gameId, hash) {
        return function() {
            prompt('Game ' + gameId + ' Hash: ', hash);
        }
    }

    return React.createClass({
        displayName: 'gamesLog',

        getInitialState: function () {
            return getState();
        },

        componentDidMount: function() {
            Engine.on({
                game_crash: this._onChange
            });
        },

        componentWillUnmount: function() {
            Engine.off({
                game_crash: this._onChange
            });
        },

        _onChange: function() {
            //Check if its mounted because when Game view receives the disconnect event from EngineVirtualStore unmounts all views
            //and the views unregister their events before the event dispatcher dispatch them with the disconnect event
            if(this.isMounted())
                this.setState(getState());
        },

        render: function () {
            var self = this;

            var rows = self.state.engine.tableHistory.slice(0, MAX_GAMES_SHOWED).map(function (game, i) {
                var cashed_at, bet, profit, bonus;
                var player = game.player_info[self.state.engine.username];
                if (player) {
                    bonus = player.bonus;
                    bet = player.bet;

                    //If the player won
                    if (player.stopped_at) {
                        profit = ((player.stopped_at / 100) * player.bet) - player.bet;
                        cashed_at = Clib.formatSatoshis(player.stopped_at);

                        //If the player lost
                    } else {
                        profit = -bet;
                        cashed_at = '-';
                    }

                    //If we got a bonus
                    if (bonus) {
                        profit = profit + bonus;
                        bonus = Clib.formatDecimals(bonus*100/bet, 2)+'%';
                    } else {
                        bonus = '0%';
                    }

                    profit = Clib.formatSatoshis(profit, 0);
                    //bet = Clib.formatSatoshis(bet); // Commented by jjb 2017.10.23.
                    bet = bet/100; // Added by jjb 2017.10.23.
                    
                    //If we didn't play
                } else {
                    cashed_at = '-';
                    bet = '-';
                    profit = '-';
                    bonus = '-';
                }

                var className;
                if (game.game_crash >= 198)
                    className = 'games-log-goodcrash';
                else if (game.game_crash <= 196)
                    className = 'games-log-badcrash';
                else
                    className = '';

                return D.tr({ key: 'game_' + i },
					//modify by lt
					D.td(null, game.game_no),
					//D.td(null, game.game_id - 1e6 + 1),
                    D.td(null,
                        D.a({ href: '/game/' + game.game_id, target: '_blank',
                            className: className
                        },
                            Clib.formatSatoshis(game.game_crash), D.i(null, 'x'))
                        ),
                    D.td(null, cashed_at),
                    D.td(null, bet),
                    D.td(null, bonus),
                    D.td(null, profit),
                    D.td(null,
                        D.input({type: 'input', className: 'games-log-hash', readOnly: true, value: game.hash }),
                        D.div({ className: 'hash-copy-cont', onClick: copyHash(game.game_id, game.hash) },
                            D.span({ className: 'hash-copy' }, D.i({ className: 'fa fa-clipboard' })))
                    )

                );
            });

            return D.div({ id: 'games-log-container' },
                D.div({ className: 'header-bg' }),
                D.div({ className: 'table-inner' },
                    D.table({ className: 'games-log' },
                        D.thead(null,
                            D.tr(null,
								D.th(null, D.div({ className: 'th-inner'}, '회차')),
                                D.th(null, D.div({ className: 'th-inner'}, '결과')),
                                D.th(null, D.div({ className: 'th-inner'}, '수익률')),
                                D.th(null, D.div({ className: 'th-inner'}, '배팅금')),
                                D.th(null, D.div({ className: 'th-inner'}, '보너스')),
                                D.th(null, D.div({ className: 'th-inner'}, '수익')),
                                D.th(null, D.div({ className: 'th-inner'}, 'Hash'))
                            )
                        ),
                        D.tbody(null,
                            rows
                        )
                    )
                )

            );
        }

    });

});