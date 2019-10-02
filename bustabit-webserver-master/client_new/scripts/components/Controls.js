define([
    'react',
    'game-logic/clib',
    'game-logic/stateLib',
    'lodash',
    'components/BetButton',
    'actions/ControlsActions',
    'stores/ControlsStore',
    'game-logic/engine'
], function(
    React,
    Clib,
    StateLib,
    _,
    BetButtonClass,
    ControlsActions,
    ControlsStore,
    Engine
){
    var BetButton = React.createFactory(BetButtonClass);

    var D = React.DOM;

    function getState(){
        return {
            betSize: ControlsStore.getBetSize(), //Bet input string in bits
            betInvalid: ControlsStore.getBetInvalid(), //false || string error message
            cashOut: ControlsStore.getCashOut(),
            cashOutChk: ControlsStore.getCashOutChk(),
            cashOutInvalid: ControlsStore.getCashOutInvalid(), //false || string error message
            engine: Engine
        }
    }

    return React.createClass({
        displayName: 'Controls',

        propTypes: {
            isMobileOrSmall: React.PropTypes.bool.isRequired,
            controlsSize: React.PropTypes.string.isRequired
        },

        getInitialState: function () {
            return getState();
        },

        componentDidMount: function() {
            ControlsStore.addChangeListener(this._onChange);
            Engine.on({
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange,
                placing_bet: this._onChange,
                bet_placed: this._onChange,
                bet_queued: this._onChange,
                cashing_out: this._onChange,
                cancel_bet: this._onChange
            });
        },

        componentWillUnmount: function() {
            ControlsStore.removeChangeListener(this._onChange);
            Engine.off({
                game_started: this._onChange,
                game_crash: this._onChange,
                game_starting: this._onChange,
                player_bet: this._onChange,
                cashed_out: this._onChange,
                placing_bet: this._onChange,
                bet_placed: this._onChange,
                bet_queued: this._onChange,
                cashing_out: this._onChange,
                cancel_bet: this._onChange
            });
        },

        _onChange: function() {
            if(this.isMounted())
                this.setState(getState());
        },

        _placeBet: function () {
            var bet = StateLib.parseBet(this.state.betSize);
            var cashOut = StateLib.parseCashOut(this.state.cashOut);
            var cashOutChk = this.state.cashOutChk;
            ControlsActions.placeBet(bet, cashOut, cashOutChk);
        },

        _cancelBet: function() {
            ControlsActions.cancelBet();
        },

        _cashOut: function() {
            ControlsActions.cashOut();
        },

        _setBetSize: function(betSize) {
            this.state.betSize = betSize.replace(/,/g, '');
            betSize = betSize.replace(/,/g, '');

            ControlsActions.setBetSize(betSize);
        },

        _setAutoCashOut: function(autoCashOut) {
            ControlsActions.setAutoCashOut(autoCashOut);
        },
        _setAutoCashOutChk: function(autoCashOutChk){
            this.state.autoCashOutChk = autoCashOutChk;
            ControlsActions.setAutoCashOutChk(autoCashOutChk);
        },
        _redirectToLogin: function() {
            window.location = '/login';
        },
        _addBetMoney1000:function(e){
            var t;
            t=100==Number(this.state.betSize)?1e3:Number(this.state.betSize)+1e3;
            this._setBetSize(t.toString());
            document.getElementById("idInput1000").blur();
        },
        _addBetMoney5000:function(e){
            var t;
            t=100==Number(this.state.betSize)?5e3:Number(this.state.betSize)+5e3;
            this._setBetSize(t.toString());
            document.getElementById("idInput5000").blur();
        },
        _addBetMoney10000:function(e){
            var t;
            t=100==Number(this.state.betSize)?1e4:Number(this.state.betSize)+1e4;
            this._setBetSize(t.toString());
            document.getElementById("idInput10000").blur();
        },
        _addBetMoney50000:function(e){
            var t;
            t=100==Number(this.state.betSize)?5e4:Number(this.state.betSize)+5e4;
            this._setBetSize(t.toString());
            document.getElementById("idInput50000").blur();
        },
        _addBetMoney100000:function(e){
            var t;
            t=100==Number(this.state.betSize)?1e5:Number(this.state.betSize)+1e5;
            this._setBetSize(t.toString());
            document.getElementById("idInput100000").blur();
        },
        _addBetMoneyInit:function(e){
            var t=0;
            this._setBetSize(t.toString());
            document.getElementById("idInputInit").blur();
        },

        render: function () {
            var self = this;

            var isPlayingOrBetting =  StateLib.isBetting(Engine) || (Engine.gameState === 'IN_PROGRESS' && StateLib.currentlyPlaying(Engine));



            // If they're not logged in, let just show a login to play
            if (!Engine.username)
                return D.div({ id: 'controls-inner-container' },
                    D.div({ className: 'login-button-container' },
                        D.button({ className: 'login-button bet-button', onClick: this._redirectToLogin }, '로그인')
                    )/*,
                    D.div({ className: 'register-container'},
                        D.a({ className: 'register', href: '/register' }, 'or register ')
                    )*/
                );

            /** Control Inputs: Bet & AutoCash@  **/
                //var controlInputs = [], betContainer
            var betContainer = D.div({ className: 'bet-container' , key: 'ci-1' },

                D.div({ className: 'bet-input-group' + (this.state.betInvalid? ' error' : '') },
                    D.span({ className: '' }, '배팅(최대 배팅금:300,000KRW)'),
                    D.input({
                        type: 'text',
                        name: 'bet-size',
                        value: this.state.betSize.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
                        //value: this.state.betSize,
                        disabled: isPlayingOrBetting,
                        onChange: function (e) {
                            self._setBetSize(e.target.value);
                        }
                    }),
                    D.span({ className: '' }, 'KRW')
                ),
                this.props.isMobileOrSmall||"small"===this.props.controlsSize?D.div({className:"moneyinput-container",style:{margin:"-15px 0px 0px 0.5rem",width:"calc(100% - 0.8rem)"}},
                    D.button({
                        id:"idInput1000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoney1000},"1,000"
                    ),
                    D.button({
                        id:"idInput5000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoney5000},"5,000"
                    ),
                    D.button({
                        id:"idInput10000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoney10000},"10,000"
                    ),
                    D.button({
                        id:"idInput50000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoney50000},"50,000"
                    ),
                    D.button({
                        id:"idInput100000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoney100000},"100,000"
                    ),
                    D.button({
                        id:"idInputInit",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        style:{width:"calc(16.9% - 2px)",marginRight:"0"},
                        onMouseDown:isPlayingOrBetting?null:this._addBetMoneyInit},"초기화"
                    )):D.div({className:"moneyinput-container"},
                    D.button({
                        id:"idInput1000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onClick:isPlayingOrBetting?null:this._addBetMoney1000},"1,000"
                    ),
                    D.button({
                        id:"idInput5000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onClick:isPlayingOrBetting?null:this._addBetMoney5000},"5,000"
                    ),
                    D.button({
                        id:"idInput10000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onClick:isPlayingOrBetting?null:this._addBetMoney10000},"10,000"
                    ),
                    D.button({
                        id:"idInput50000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onClick:isPlayingOrBetting?null:this._addBetMoney50000},"50,000"
                    ),
                    D.button({
                        id:"idInput100000",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        onClick:isPlayingOrBetting?null:this._addBetMoney100000},"100,000"
                    ),
                    D.button({
                        id:"idInputInit",
                        className:isPlayingOrBetting?"inputmoney-disable-button":"inputmoney-button",
                        style:{width:"calc(16.9% - 2px)",marginRight:"0"},
                        onClick:isPlayingOrBetting?null:this._addBetMoneyInit},"초기화"
                    ))
                );

            var autoCashContainer = D.div({ className: 'autocash-container', key: 'ci-2' },

                D.div({ className: 'bet-input-group' + (this.state.cashOutInvalid? ' error' : '') },
                    D.span({ className: '' }, '자동출금'),
                    D.input({
                        min: 1,
                        step: 0.01,
                        value: self.state.cashOut,
                        type: 'number',
                        name: 'cash-out',
                        disabled: isPlayingOrBetting,
                        onChange: function (e) {
                            self._setAutoCashOut(e.target.value);
                        }
                    }),
                    D.span({ className: '' }, 'x')
                ),
                D.input({
                    className: 'autoOutCheckbox',
                    type: 'checkbox',
                    disabled: isPlayingOrBetting,
                    name: 'autoOutChkbox',
                    onChange: function(e){
                        console.log(e.target.checked);
                        self._setAutoCashOutChk(e.target.checked);
                    }
                }, '자동출금사용안함')

            );

            var controlInputs;
            if(this.props.isMobileOrSmall || this.props.controlsSize === 'small') {
                controlInputs = D.div({ className: 'control-inputs-container' },
                    D.div({ className: 'input-control' },
                        betContainer
                    ),

                    D.div({ className: 'input-control' },
                        autoCashContainer
                    )
                );
            } else {
                controlInputs = [];

                controlInputs.push(D.div({ className: 'input-control controls-row', key: 'coi-1' },
                    betContainer
                ));

                controlInputs.push(D.div({ className: 'input-control controls-row', key: 'coi-2' },
                    autoCashContainer
                ));
            }

            //If the user is logged in render the controls
            return D.div({ id: 'controls-inner-container', className: this.props.controlsSize },

                controlInputs,

                D.div({ className: 'button-container' },
                    BetButton({
                        engine: this.state.engine,
                        placeBet: this._placeBet,
                        cancelBet: this._cancelBet,
                        cashOut: this._cashOut,
                        isMobileOrSmall: this.props.isMobileOrSmall,
                        betSize: this.state.betSize,
                        betInvalid: this.state.betInvalid,
                        cashOutInvalid: this.state.cashOutInvalid,
                        controlsSize: this.props.controlsSize
                    })
                )

            );
        }

        //_getStatusMessage: function () {
        //    var pi = this.state.engine.currentPlay();
        //
        //    if (this.state.engine.gameState === 'STARTING') {
        //        return Countdown({ engine: this.state.engine });
        //    }
        //
        //    if (this.state.engine.gameState === 'IN_PROGRESS') {
        //        //user is playing
        //        if (pi && pi.bet && !pi.stopped_at) {
        //            return D.span(null, 'Currently playing...');
        //        } else if (pi && pi.stopped_at) { // user has cashed out
        //            return D.span(null, 'Cashed Out @  ',
        //                D.b({className: 'green'}, pi.stopped_at / 100, 'x'),
        //                ' / Won: ',
        //                D.b({className: 'green'}, Clib.formatSatoshis(pi.bet * pi.stopped_at / 100)),
        //                ' ', Clib.grammarBits(pi.bet * pi.stopped_at / 100)
        //            );
        //
        //        } else { // user still in game
        //            return D.span(null, 'Game in progress..');
        //        }
        //    } else if (this.state.engine.gameState === 'ENDED') {
        //
        //        var bonus;
        //        if (pi && pi.stopped_at) { // bet and won
        //
        //            if (pi.bonus) {
        //                bonus = D.span(null, ' (+',
        //                    Clib.formatSatoshis(pi.bonus), ' ',
        //                    Clib.grammarBits(pi.bonus), ' bonus)'
        //                );
        //            }
        //
        //            return D.span(null, 'Cashed Out @ ',
        //                D.b({className: 'green'}, pi.stopped_at / 100, 'x'),
        //                ' / Won: ',
        //                D.b({className: 'green'}, Clib.formatSatoshis(pi.bet * pi.stopped_at / 100)),
        //                ' ', Clib.grammarBits(pi.bet * pi.stopped_at / 1000),
        //                bonus
        //            );
        //        } else if (pi) { // bet and lost
        //
        //            if (pi.bonus) {
        //                bonus = D.span(null, ' (+ ',
        //                    Clib.formatSatoshis(pi.bonus), ' ',
        //                    Clib.grammarBits(pi.bonus), ' bonus)'
        //                );
        //            }
        //
        //            return D.span(null,
        //                'Busted @ ', D.b({className: 'red'},
        //                    this.state.engine.tableHistory[0].game_crash / 100, 'x'),
        //                ' / You lost ', D.b({className: 'red'}, pi.bet / 100), ' ', Clib.grammarBits(pi.bet),
        //                bonus
        //            );
        //
        //        } else { // didn't bet
        //
        //          if (this.state.engine.tableHistory[0].game_crash === 0) {
        //            return D.span(null, D.b({className: 'red'}, 'INSTABUST!'));
        //          }
        //
        //          return D.span(null,
        //              'Busted @ ', D.b({className: 'red'}, this.state.engine.tableHistory[0].game_crash / 100, 'x')
        //          );
        //        }
        //
        //    }
        //}
    });
});