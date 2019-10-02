var CBuffer = require('CBuffer');
var database = require('./database');
var _ = require('lodash');

function GameHistory1 (gameTable) {
    var self = this;
    self.gameTable = new CBuffer(20);
    gameTable.forEach(function(game) {
        self.gameTable.push(game);
    });
}

GameHistory1.prototype.addCompletedGame = function (game) {
    this.gameTable.unshift(game);
};

GameHistory1.prototype.getHistory = function () {
    return this.gameTable.toArray();
};

module.exports = GameHistory1;
