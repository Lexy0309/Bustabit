define(['strategies/auto-bet', 'strategies/custom'], function(Autobet, Custom){
    return {
        autoBet: Autobet,
        custom: Custom
    }
});