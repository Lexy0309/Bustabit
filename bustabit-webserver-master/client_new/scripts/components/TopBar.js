define([
    'react',
    'game-logic/engine',
    'stores/GameSettingsStore',
    'actions/GameSettingsActions',
    'game-logic/clib',
    'screenfull'
], function(
    React,
    Engine,
    GameSettingsStore,
    GameSettingsActions,
    Clib,
    Screenfull //Attached to window.screenfull
) {
    var D = React.DOM;

    function getState() {
        return {
            balanceBitsFormatted: Clib.formatSatoshis(Engine.balanceSatoshis, 0),

			point: Clib.formatSatoshis(Engine.point, 0),
			
			unread_count : Number(Engine.unread_count),
			unread_qna : Number(Engine.unread_qna),
			unread_charge : Number(Engine.unread_charge) + Number(Engine.unread_exchange),
			unread_rpy: Number(Engine.unread_rpy),
			new_user: Number(Engine.new_user),
			userclass: Engine.userclass,
            theme: GameSettingsStore.getCurrentTheme()//black || white
        }
    }

    return React.createClass({
        displayName: 'TopBar',

        propTypes: {
            isMobileOrSmall: React.PropTypes.bool.isRequired
        },

        getInitialState: function() {
            var state = getState();
            state.username = Engine.username;
			//state.userclass = Engine.userclass;

            state.fullScreen = false;
            return state;
        },

        componentDidMount: function() {
            Engine.on({
                game_started: this._onChange,
                game_crash: this._onChange,
                cashed_out: this._onChange
            });
            GameSettingsStore.on('all', this._onChange);
        },

        componentWillUnmount: function() {
            Engine.off({
                game_started: this._onChange,
                game_crash: this._onChange,
                cashed_out: this._onChange
            });
            GameSettingsStore.off('all', this._onChange);
        },

        _onChange: function() {
            this.setState(getState());

        },

        _toggleTheme: function() {
            GameSettingsActions.toggleTheme();
        },

        _toggleFullScreen: function() {
        	window.screenfull.toggle();
            this.setState({ fullScreen: !this.state.fullScreen });
        },
		_pointChange: function() {
			if( Engine.point < 500000)
				window.alert('5천원이상부터 포인트가 전환됩니다.');	
			else 
				Engine.changePoint(this.state.username, (function (err) {
					console.log('Point Change');
				})
				);
		},

        render: function() {

            var userLogin;
            if(this.state.username && this.state.userclass!='admin') {
                userLogin = D.div({ className: 'user-login' },
                    D.div({ className: 'balance-bits' },
                        D.span(null, 'KRW: '),
                        D.span({ className: 'balance' }, this.state.balanceBitsFormatted )
                    ),
					D.div({ className: 'balance-bits' },
                        D.span(null, 'P: '),
                        D.span({ className: 'balance' }, this.state.point )
                    ),
					/*D.div({ className: 'username' },
						D.button({ className: 'strategy-start', style:{backgroundColor: '#008cba', borderStyle: 'solid', borderWidth: '0px'}, onClick: this._pointChange }, 'P전환')
						//D.a({ href: '/logout'}, 'P전환')
					),*/
                    D.div({ className: 'username' },
						D.span(null, this.state.username),
                        D.a({ href: '/logout'}, '로그아웃')
					)
                );
            } else if (this.state.username && this.state.userclass=='admin')
            {
				userLogin = D.div({ className: 'user-login' },
                    D.div({ className: 'balance-bits' },
                        D.span(null, 'KRW: '),
                        D.span({ className: 'balance' }, this.state.balanceBitsFormatted )
                    ),
                    D.div({ className: 'username' },
						D.span(null, this.state.username),
                        D.a({ href: '/logout'}, '로그아웃')
					)
                );

            }else {
                userLogin = D.div({ className: 'user-login' },
                    D.div({ className: 'register' },
                        D.a({ href: '/register' }, '회원가입' )
                    ),
                    D.div({ className: 'login' },
                        D.a({ href: '/login'}, '로그인' )
                    )
                );
            }
			if(this.state.userclass == 'admin') {
				return D.div({ id: 'top-bar' },
					D.div({ className: 'title' },
						D.a({ href: '/' },
							D.h1(null, this.props.isMobileOrSmall? 'ML' : 'MaxLine')
						)
					),
					D.div({ className: 'menu', style:{marginRight: '1rem'}},
			
						D.ul({className:'nav-list'},
							D.li( {className: 'nav-item'},
								D.a({href: '/play'}, '게임')
							),
							D.li( {className: 'nav-item', style: {paddingRight: this.state.new_user > 0? '0px': '1rem'}},
								D.a({href: '/admin-user'}, '회원/접속자')
							),
							D.div( {className: this.state.new_user > 0? 'dot_memo font_tiny bold' : 'unread_dot4 dot_memo font_tiny bold'},
								D.span( {id: 'new_user'}, this.state.new_user
								)
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-partner'}, '총판관리')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-todaymoney'}, '통계및정산')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-virUser'}, '가상유저')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-maxprofit'}, '설정')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-account'}, '계정관리')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-badip'}, 'IP차단')
							),
							D.li( {className: 'nav-item', style: {paddingRight: (this.state.unread_charge > 0 || this.state.unread_exchange)? '0px': '1rem'}},
								D.a({href: '/admin-money-charge'}, '충환전')
							),
							D.div( {className: this.state.unread_charge > 0? 'dot_memo font_tiny bold' : 'unread_dot1 dot_memo font_tiny bold'},
								D.span( {id: 'unread_charge'}, this.state.unread_charge
								)
							),
							D.li( {className: 'nav-item'},
								//D.a({onClick:this._needLogin}, '공지')
								D.a({href: '/admin-notice'}, '공지')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-memo'}, '쪽지함')
							),
							D.li( {className: 'nav-item', style: {paddingRight: this.state.unread_qna > 0? '0px': '1rem'}},
								D.a({href: '/admin-qna'}, '1:1문의')
							),
							D.div( {className: this.state.unread_qna > 0 ? 'dot_memo font_tiny bold':'unread_dot2 dot_memo font_tiny bold'},
								D.span( {id: 'unread_qna'}, this.state.unread_qna
								)
							)	
						)
					),
					userLogin
				)
			}
			if(this.state.userclass == 'distributor') {
				return D.div({ id: 'top-bar' },
					D.div({ className: 'title' },
						D.a({ href: '/' },
							D.h1(null, this.props.isMobileOrSmall? 'ML' : 'MaxLine')
						)
					),
					D.div({ className: 'menu'},
						D.ul({className:'nav-list'},
							D.li( {className: 'nav-item'},
								D.a({href: '/play'}, '게임')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-user'}, '회원/접속자관리')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-partner'}, '추천인관리')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-todaymoney'}, '통계 및 정산')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-money-charge'}, '충환전')
							)
						)
					),
					userLogin
				)
			}
			if(this.state.userclass == 'partner') {
				return D.div({ id: 'top-bar' },
					D.div({ className: 'title' },
						D.a({ href: '/' },
							D.h1(null, this.props.isMobileOrSmall? 'ML' : 'MaxLine')
						)
					),
					D.div({ className: 'menu'},
						D.ul({className:'nav-list'},
							D.li( {className: 'nav-item', style: {paddingRight: '5px'}},
								D.a({href: '/play'}, '게임')
							),
							D.li( {className: 'nav-item', style: {paddingRight: '5px'}},
								D.a({href: '/admin-user'}, '회원/접속자관리')
							),
							D.li( {className: 'nav-item', style: {paddingRight: '5px'}},
								D.a({href: '/admin-todaymoney'}, '통계 및 정산')
							),
							D.li( {className: 'nav-item'},
								D.a({href: '/admin-money-charge'}, '충환전')
							)
						)
					),
					userLogin
				)
			}

				return D.div({ id: 'top-bar' },
                D.div({ className: 'title' },
                    D.a({ href: '/' },
                        D.h1(null, this.props.isMobileOrSmall? 'ML' : 'MaxLine')
                    )
                ),
				D.div({ className: 'menu'},
					D.ul({className:'nav-list'},
						D.li( {className: 'nav-item'},
							D.a({href: '/play'}, '게임')
						),
						D.li( {className: 'nav-item'},
							D.a({href: '/money-charge'}, '충환전')
						),
						D.li( {className: 'nav-item'},
							D.a({href:this.state.username?'/user/'+this.state.username:'/login'},'배팅내역')
							
						),
						D.li( {className: 'nav-item'},
							D.a({href: '/leaderboard'}, '랭킹')
						),
						D.li( {className: 'nav-item'},
							//D.a({onClick:this._needLogin}, '공지')
							D.a({href: '/notice-list'}, '공지')
						),
						D.li( {className: 'nav-item', style: {paddingRight: this.state.unread_count > 0? '0px': '1rem'}},
							D.a({href: '/memo-list'}, '쪽지함')
						),
						D.div( {className: this.state.unread_count > 0? 'dot_memo font_tiny bold': 'unread_dot dot_memo font_tiny bold'},
							D.span( {id: 'unread_text'}, this.state.unread_count
							)
						),
						D.li( {className: 'nav-item', style: this.state.unread_rpy > 0? {paddingRight: '0px'}: {paddingRight: '1rem'}},
							D.a({href: '/qna-list'}, '1:1문의')
						),
						D.div( {className: this.state.unread_rpy > 0? 'dot_memo font_tiny bold': 'unread_dot3 dot_memo font_tiny bold'},
							D.span( {id: 'unread_rpy'}, this.state.unread_rpy
							)
						),
						D.li( {className: 'nav-item'},
							D.a({href: '/faq'}, '가이드')
						)	
					)
				),
                userLogin,
                D.div({ className: 'toggle-view noselect' + ((this.state.theme === 'white')? ' black' : ' white'), onClick: this._toggleTheme },
                    D.a(null,
                        (this.state.theme === 'white')? 'Black' : 'White'
                    )
                ),
                D.div({ className: 'full-screen noselect', onClick: this._toggleFullScreen },
                	 this.state.fullScreen? D.i({ className: 'fa fa-compress' }) : D.i({ className: 'fa fa-expand' })
            	)
            )
        }
    });
});