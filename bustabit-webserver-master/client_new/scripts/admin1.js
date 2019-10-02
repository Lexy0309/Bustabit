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
		Engine.getGameHashs(curGameID - 1, MAX_GAMES_SHOWED);
    }

	function prePage() {
		curGameID -= MAX_GAMES_SHOWED;

		if (curGameID < 1)
			curGameID = 1;

		Engine.getGameHashs(curGameID - 1, MAX_GAMES_SHOWED);
    }

	function movePage() {
		
		curGameID = Number(nGameID);
		console.log(curGameID);
		Engine.getGameHashs(nGameID - 1, MAX_GAMES_SHOWED);		
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
        displayName: 'gamesLog',

        getInitialState: function () {
			console.log('getInitialState');
            return getState();
        },

        componentDidMount: function() {
			console.log('componentDidMount');
            Engine.on({
                game_hash: this._onChange,
				refresh_Page: this._onChange,
				update_hash: this._onChange
            });

        },

        componentWillUnmount: function() {
			console.log('componentWillUnmount');
            Engine.off({
                game_hash: this._onChange,
				refresh_Page: this._onChange,
				update_hash: this._onChange
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

			if (renderType == 0)
			{
				var rows = self.state.engine.gameHashs.slice(0, MAX_GAMES_SHOWED).map(function (game, i) {

					var className;
					return D.tr({ key: 'game_' + i },
						D.td(null, game.game_id),
						D.td(null,
							D.input({type: 'input', className: 'games-log-hash', readOnly: true, value: game.hash / 100 }),
							D.div({ className: 'hash-copy-cont', onClick: refreshPages_(game.game_id) },
								D.span({ className: 'hash-copy' }, D.i({ className: 'fa fa-clipboard' })))
						)

						);
					});
				
				return D.div({ id: 'admin-hash-container' },
					D.div({ className: 'header-bg' }),
					/*
					D.div({ className: 'hash_pages3' },
						D.label({ htmlFor: 'activate-hotkeys' },'서버머니'),
						D.input({type: 'number' , ref: 'maxProfit',onChange: this.updateProfit}),
						D.button({ className: '', onClick: setMaxProfit }, '적용')
						),
					D.div({ className: 'hash_pages4' },
						D.label({ htmlFor: 'activate-hotkeys' },'퍼센트('+self.state.engine.serverPercent+')'),
						D.input({type: 'number' , ref: 'percent',onChange: this.updatePercent}),
						D.button({ className: '', onClick: setPercent }, '적용')
						),
						*/
					D.div({ className: 'table-inner' },
						D.table({ className: 'games-log' },
							D.thead(null,
								D.tr(null,
									D.th(null, D.div({ className: 'th-inner'}, '회차')),
									D.th(null, D.div({ className: 'th-inner'}, '배당값'))
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
			else
			{
				return D.div({ className: 'hash_page1' },
					D.input({type: 'number' , ref: 'crash',onChange: this.updateCrash}),
					D.button({ className: '', onClick: setCrash }, '확인'),
					D.button({ className: '', onClick: cancelCrash }, '취소')
				);
			}
        }

    });

});