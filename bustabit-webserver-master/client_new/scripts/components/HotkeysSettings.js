define([
    'react',
    'stores/GameSettingsStore',
    'actions/HotkeysActions'
], function(
    React,
    GameSettingsStore,
    HotkeysActions
) {
    var D = React.DOM;

    function getState() {
        return GameSettingsStore.getState();
    }

    return React.createClass({
        displayName: 'Hotkeys Settings',

        getInitialState: function() {
            return getState();
        },

        componentDidMount: function() {
            GameSettingsStore.addChangeListener(this._onChange);
        },

        componentWillUnmount: function() {
            GameSettingsStore.removeChangeListener(this._onChange);
        },

        _onChange: function() {
            if(this.isMounted())
                this.setState(getState());
        },

        _hotkeysActiveChange: function(e) {
            HotkeysActions.toggleHotkeysState();
        },

        render: function() {
            return D.div({ id: 'hotkeys-settings-container'},

                D.div({ className: 'activation-row' },
                    D.input({ id: 'activate-hotkeys', type: 'checkbox', checked: this.state.hotkeysActive, onChange: this._hotkeysActiveChange }),
                    D.label({ htmlFor: 'activate-hotkeys' }, '단축키 활성화')
                ),

                D.div({ className: 'hotkeys-list' },
                    D.span(null, '배팅 (SPACE)'),
                    D.span(null, '더블 배팅 bet (C)'),
                    D.span(null, '절반 배팅 (X)')
                )

            );
        }
    });
});