define([
   'react',
    'components/GamesLog',
    'components/GamesLog1'
], function(
    React,
    GamesLogClass,
    GamesLog1Class
) {
    var D = React.DOM;

    var GamesLog = React.createFactory(GamesLogClass);
    var GamesLog1 = React.createFactory(GamesLog1Class);
    
    return React.createClass({
        displayName: 'Settings',

        getInitialState: function() {
            return {
                selectedTab: 'GamesLog' //GamesLog || GamesLog1
            }
        },

        _selectTab: function(tabName) {
            var self = this;
            return function() {
                self.setState({ selectedTab: tabName });
            }
        },

        render: function() {

            var selectedTab;
            switch(this.state.selectedTab) {
                case 'GamesLog':
                    selectedTab = GamesLog();
                    break;
                case 'GamesLog1':
                    selectedTab = GamesLog1();
                    break;
            }

            return D.div({ id: 'settings-selector-container' },
                D.div({ className: 'tabs-container noselect' },
                    D.div({ className: 'tab-holder' + (this.state.selectedTab === 'GamesLog'? ' tab-active' : ''), onClick: this._selectTab('GamesLog') },
                        D.a(null,  '전체게임' )
                    ),
                    D.div({ className: 'tab-holder' + (this.state.selectedTab === 'GamesLog1'? ' tab-active' : ''), onClick: this._selectTab('GamesLog1') },
                        D.a(null,  '플레이한게임' )
                    )
                ),

                D.div({ className: 'settings-widget-container' },
                    selectedTab
                )
            )
        }
    });
});