requirejs.config({
    baseUrl: "/scripts", //If no baseUrl is explicitly set in the configuration, the default value will be the location of the HTML page that loads require.js.
    paths: {
        autolinker: '../../node_modules/autolinker/dist/Autolinker',
        classnames: '../../node_modules/classnames/index',
        lodash: '../../node_modules/lodash/index',
        react: '../../node_modules/react/dist/react-with-addons',
        seedrandom: '../../node_modules/seedrandom/seedrandom',
        socketio: '../../node_modules/socket.io-client/socket.io',
        mousetrap: '../../node_modules/mousetrap/mousetrap',
        screenfull: '../../node_modules/screenfull/dist/screenfull',
		serverpath: '../../server'
    },
    shim: {
		
    }
});

define([
    'react',
    'admin1',
], function(
    React,
    Admin1Class
) {

    var Admin1 = React.createFactory(Admin1Class);

    React.render(		
        Admin1(),
        document.getElementById('game-container')
    );
});