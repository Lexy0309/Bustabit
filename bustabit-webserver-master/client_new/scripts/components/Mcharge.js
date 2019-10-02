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
    var MAX_GAMES_SHOWED = 30;

    var D = React.DOM;

	var curGameID = 1;
	var nGameID;
	var renderType = 0;
	var crashPoint;
	var init = 0;
	var maxProfit;

    function getState(){
        return {
            engine: Engine
        }
    }

    function copyHash(gameId, hash, i) {
        return function() {
            //var temp = this.refs['crash_'+i].getDOMNode().value;
			console.log('copyHash');
        }
    }
	function nextPage() {
		
		curGameID += MAX_GAMES_SHOWED;
		console.log(curGameID);
		Engine.getChargeHistory(0, MAX_GAMES_SHOWED);
    }

	function prePage() {
		curGameID -= MAX_GAMES_SHOWED;

		if (curGameID < 1)
			curGameID = 1;

		Engine.getChargeHistory(curGameID - 1, MAX_GAMES_SHOWED);
    }
	function movePage() {
		
		curGameID = Number(nGameID);
		console.log(curGameID);
		Engine.getChargeHistory(nGameID - 1, MAX_GAMES_SHOWED);		
    }

	function refreshPages_(gameid) {
		return function() {
			console.log('refreshPages');
			
			renderType = 1;
			nGameID = gameid;
			
			Engine.refreshPage();
		}
    }

	function setCrash() {
		console.log('setCrash');		
		console.log(crashPoint);
		renderType = 0;

		if (crashPoint >= 0)
		{
			Engine.updateGameHash(nGameID,  Math.floor(crashPoint*100), (function (err) {
					console.log('setCrash callback');
					Engine.getGameHashs(curGameID - 1, MAX_GAMES_SHOWED);
				})
			);
		}
		else
		{
			alert('배당값을 정확히 입력해주세요.');
		}
    }

	function setMaxProfit() {
		console.log('setMaxProfit');
		renderType = 0;

			Engine.updateMaxProfit(maxProfit, (function (err) {
					console.log('setMaxProfit callback');
				})
			);
    }

	function setPercent() {
		console.log('setPercent');
		renderType = 0;

			Engine.updatePercent(serverPercent, (function (err) {
					console.log('setPercent callback');
				})
			);

			window.location.reload(true);
    }

	function cancelCrash() {
		console.log('cancelCrash');
		renderType = 0;
		Engine.refreshPage();
    }

    return React.createClass({
        displayName: 'Mcharge',

        getInitialState: function () {
			console.log('getInitialState');
			Engine.getChargeHistory(0, MAX_GAMES_SHOWED);
            return getState();
        },

        componentDidMount: function() {
			console.log('componentDidMount');
            Engine.on({
                money_charge: this._onChange,
				refresh_Page: this._onChange
            });

        },

        componentWillUnmount: function() {
			console.log('componentWillUnmount');
            Engine.off({
                money_charge: this._onChange,
				refresh_Page: this._onChange
            });
        },

        _onChange: function() {
            //Check if its mounted because when Game view receives the disconnect event from EngineVirtualStore unmounts all views
            //and the views unregister their events before the event dispatcher dispatch them with the disconnect event
            if(this.isMounted())
                this.setState(getState());
        },

		updateGameID: function() {
            var amount = this.refs.gameID.getDOMNode().value;
            nGameID = amount;
        },

		updateCrash: function() {
            var amount = this.refs.crash.getDOMNode().value;
			crashPoint = amount;
        },

		updateProfit: function() {
            var amount = this.refs.maxProfit.getDOMNode().value;
			maxProfit = amount;
        },

		updatePercent: function() {
            var amount = this.refs.percent.getDOMNode().value;
			serverPercent = amount;
        },

        render: function () {
            var self = this;
			console.log('render');
			console.log(self.state.engine.moneyHistory);
				var rows = self.state.engine.moneyHistory.slice(0, MAX_GAMES_SHOWED).map(function (money, i) {
					var className;
					console.log(money);
					return D.tr(null,
						D.td({style: {width: '10%'}}, D.input({type:'checkbox', id: 'idChkData' + money.id})),
						D.td({style: {width: '20%'}}, '충전'),
						D.td({style: {width: '20%'}}, money.balance),
						D.td({style: {width: '20%'}}, money.pay_state),
						D.td({style: {width: '30%'}}, money.end_datetime)
						);
					});
					/*
					return D.tr({ key: 'money_' + i },
						D.td(null, money.id),
						D.td(null,
							D.input({type: 'input', className: 'games-log-hash', readOnly: true, value: money.balance / 100 }),
							D.div({ className: 'hash-copy-cont', onClick: refreshPages_(money.id) },
								D.span({ className: 'hash-copy' }, D.i({ className: 'fa fa-clipboard' })))
						)

						);
					});*/
		
				return D.div({ id: 'admin-hash-container' },
					D.button({className: 'button secondary left', onClick: setCrash }, '선택 내역 삭제'),
					D.div({ className: 'table-inner' },
						D.table({ className: 'leaders' },
							D.thead(null,
								D.tr(null,
									D.td({ style: {width: '10%' }}, D.input({type: 'checkbox', id: 'idChkAll', onClick: this.SelectHistoryAll})),
									D.td({style: {width: '20%'}}, '구분'),
									D.td({style: {width: '20%'}}, '금액'),
									D.td({style: {width: '20%'}}, '상태'),
									D.td({style: {width: '30%'}}, '날짜')
								)
							),
							D.tbody(null,  
								rows	
							)
						)
					),				
					D.div({ className: 'hash_pages' }, 
						D.input({type: 'number' , ref: 'gameID',onChange: this.updateGameID, value : self.curGameID}),
						D.button({ className: '', onClick: movePage }, '회차로 이동'),
						D.button({ className: '', onClick: prePage }, '이전'),
						D.button({ className: '', onClick: nextPage }, '다음')
					)
				);
        }

    });

});