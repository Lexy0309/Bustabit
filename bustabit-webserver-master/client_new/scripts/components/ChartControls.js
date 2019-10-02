define([
    'react',
    'components/GraphicsContainer',
    'components/ControlsSelector',
	'game-logic/engine'
], function(
    React,
    GraphicsContainerClass,
    ControlsSelectorClass,
	Engine
) {
    var D = React.DOM;

    var GraphicsContainer =  React.createFactory(GraphicsContainerClass);
    var ControlsSelector = React.createFactory(ControlsSelectorClass);

    return React.createClass({
        displayName: 'Chart-Controls',

        propTypes: {
            isMobileOrSmall: React.PropTypes.bool.isRequired,
            controlsSize: React.PropTypes.string.isRequired
        },

        render: function() {
			/*
			var betResult = null;
			var t= document.body.offsetWidth*(this.props.isMobileorSmall?100:65)/100-15;
			var	n = this.props.isMobileOrSmall?60:70;
			var s = parseInt(GraphicsContainerClass/ControlsSelectorClass);
			4>s?s=4:s>50&&(s=50);
			var c="calc((100% - "+(5*s+5)+"px) / "+s+")";
			var l=["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];
			var u=["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];
			var p=["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];
			var d=["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""];
			var h=["none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none","none"];
			if(null!=Engine.tableHistory[0])
				for(var f = 0; f < 50; f++){
					
					console.log(Engine.tableHistory[f]);
					//l[f]=Engine.tableHistory[f].game_crash;//round
					//u[f]=Engine.tableHistory[f][1];//game_crash
					l[f] = '5';
					u[f] = '10';
					var m=Number(u[f]);
					m>197?p[f]="result-box-green":197>m?p[f]="result-box-red":p[f]="result-box-black";
					0==m?d[f]="0x":-1==m?d[f]="무효":d[f]=(m/100).toFixed(2)+"x";
					parseInt(m)>=1e5&&(d[f]=(parseInt(parseInt(m)/1e4)/10).toFixed(1)+"K");
					h[f]=s>f?"block":"none"
				}
			return betResult=this.props.isMobileOrSmall?D.div({id:"result-container"},
				D.div({className:"result-box",style:{width:c,display:h[0],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[0]+"회"
					),
					D.div({className:"result-box-inner "+p[0]},
						D.div({className:"result-box-inner-crash"},d[0])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[1]}},
					D.div({className:"result-box-inner"},l[1]+"회"
					),
					D.div({className:"result-box-inner "+p[1]},
						D.div({className:"result-box-inner-crash"},d[1])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[2]}},
					D.div({className:"result-box-inner"},l[2]+"회"
					),
					D.div({className:"result-box-inner "+p[2]},
						D.div({className:"result-box-inner-crash"},d[2])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[3]}},
					D.div({className:"result-box-inner"},l[3]+"회"
					),
					D.div({className:"result-box-inner "+p[3]},
						D.div({className:"result-box-inner-crash"},d[3])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[4]}},
					D.div({className:"result-box-inner"},l[4]+"회"
					),
					D.div({className:"result-box-inner "+p[4]},
						D.div({className:"result-box-inner-crash"},d[4])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[5],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[5]+"회"
					),
					D.div({className:"result-box-inner "+p[5]},
						D.div({className:"result-box-inner-crash"},d[5])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[6]}},
					D.div({className:"result-box-inner"},l[6]+"회"
					),
					D.div({className:"result-box-inner "+p[6]},
						D.div({className:"result-box-inner-crash"},d[6])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[7]}},
					D.div({className:"result-box-inner"},l[7]+"회"
					),
					D.div({className:"result-box-inner "+p[7]},
						D.div({className:"result-box-inner-crash"},d[7])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[8]}},
					D.div({className:"result-box-inner"},l[8]+"회"
					),
					D.div({className:"result-box-inner "+p[8]},
						D.div({className:"result-box-inner-crash"},d[8])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[9]}},
					D.div({className:"result-box-inner"},l[9]+"회"
					),
					D.div({className:"result-box-inner "+p[9]},
						D.div({className:"result-box-inner-crash"},d[9])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[10]}},
					D.div({className:"result-box-inner"},l[10]+"회"
					),
					D.div({className:"result-box-inner "+p[10]},
						D.div({className:"result-box-inner-crash"},d[10])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[11]}},
					D.div({className:"result-box-inner"},l[11]+"회"
					),
					D.div({className:"result-box-inner "+p[11]},
						D.div({className:"result-box-inner-crash"},d[11])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[12]}},
					D.div({className:"result-box-inner"},l[12]+"회"
					),
					D.div({className:"result-box-inner "+p[12]},
						D.div({className:"result-box-inner-crash"},d[12])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[13]}},
					D.div({className:"result-box-inner"},l[13]+"회"
					),
					D.div({className:"result-box-inner "+p[13]},
						D.div({className:"result-box-inner-crash"},d[13])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[14]}},
					D.div({className:"result-box-inner"},l[14]+"회"
					),
					D.div({className:"result-box-inner "+p[14]},
						D.div({className:"result-box-inner-crash"},d[14])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[15],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[15]+"회"
					),
					D.div({className:"result-box-inner "+p[15]},
						D.div({className:"result-box-inner-crash"},d[15])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[16]}},
					D.div({className:"result-box-inner"},l[16]+"회"
					),
					D.div({className:"result-box-inner "+p[16]},
						D.div({className:"result-box-inner-crash"},d[16])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[17]}},
					D.div({className:"result-box-inner"},l[17]+"회"
					),
					D.div({className:"result-box-inner "+p[17]},
						D.div({className:"result-box-inner-crash"},d[17])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[18]}},
					D.div({className:"result-box-inner"},l[18]+"회"
					),
					D.div({className:"result-box-inner "+p[18]},
						D.div({className:"result-box-inner-crash"},d[18])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[19]}},
					D.div({className:"result-box-inner"},l[19]+"회"
					),
					D.div({className:"result-box-inner "+p[19]},
						D.div({className:"result-box-inner-crash"},d[19])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[20]}},
					D.div({className:"result-box-inner"},l[20]+"회"
					),
					D.div({className:"result-box-inner "+p[20]},
						D.div({className:"result-box-inner-crash"},d[20])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[21]}},
					D.div({className:"result-box-inner"},l[21]+"회"
					),
					D.div({className:"result-box-inner "+p[21]},
						D.div({className:"result-box-inner-crash"},d[21])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[22]}},
					D.div({className:"result-box-inner"},l[22]+"회"
					),
					D.div({className:"result-box-inner "+p[22]},
						D.div({className:"result-box-inner-crash"},d[22])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[23]}},
					D.div({className:"result-box-inner"},l[23]+"회"
					),
					D.div({className:"result-box-inner "+p[23]},
						D.div({className:"result-box-inner-crash"},d[23])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[24]}},
					D.div({className:"result-box-inner"},l[24]+"회"
					),
					D.div({className:"result-box-inner "+p[24]},
						D.div({className:"result-box-inner-crash"},d[24])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[25],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[25]+"회"
					),
					D.div({className:"result-box-inner "+p[25]},
						D.div({className:"result-box-inner-crash"},d[25])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[26]}},
					D.div({className:"result-box-inner"},l[26]+"회"
					),
					D.div({className:"result-box-inner "+p[26]},
						D.div({className:"result-box-inner-crash"},d[26])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[27]}},
					D.div({className:"result-box-inner"},l[27]+"회"
					),
					D.div({className:"result-box-inner "+p[27]},
						D.div({className:"result-box-inner-crash"},d[27])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[28]}},
					D.div({className:"result-box-inner"},l[28]+"회"
					),
					D.div({className:"result-box-inner "+p[28]},
						D.div({className:"result-box-inner-crash"},d[28])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[29]}},
					D.div({className:"result-box-inner"},l[29]+"회"
					),
					D.div({className:"result-box-inner "+p[29]},
						D.div({className:"result-box-inner-crash"},d[29])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[30]}},
					D.div({className:"result-box-inner"},l[30]+"회"
					),
					D.div({className:"result-box-inner "+p[30]},
						D.div({className:"result-box-inner-crash"},d[30])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[31]}},
					D.div({className:"result-box-inner"},l[31]+"회"
					),
					D.div({className:"result-box-inner "+p[31]},
						D.div({className:"result-box-inner-crash"},d[31])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[32]}},
					D.div({className:"result-box-inner"},l[32]+"회"
					),
					D.div({className:"result-box-inner "+p[32]},
						D.div({className:"result-box-inner-crash"},d[32])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[33]}},
					D.div({className:"result-box-inner"},l[33]+"회"
					),
					D.div({className:"result-box-inner "+p[33]},
						D.div({className:"result-box-inner-crash"},d[33])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[34]}},
					D.div({className:"result-box-inner"},l[34]+"회"
					),
					D.div({className:"result-box-inner "+p[34]},
						D.div({className:"result-box-inner-crash"},d[34])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[35],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[35]+"회"
					),
					D.div({className:"result-box-inner "+p[35]},
						D.div({className:"result-box-inner-crash"},d[35])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[36]}},
					D.div({className:"result-box-inner"},l[36]+"회"
					),
					D.div({className:"result-box-inner "+p[36]},
						D.div({className:"result-box-inner-crash"},d[36])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[37]}},
					D.div({className:"result-box-inner"},l[37]+"회"
					),
					D.div({className:"result-box-inner "+p[37]},
						D.div({className:"result-box-inner-crash"},d[37])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[38]}},
					D.div({className:"result-box-inner"},l[38]+"회"
					),
					D.div({className:"result-box-inner "+p[38]},
						D.div({className:"result-box-inner-crash"},d[38])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[39]}},
					D.div({className:"result-box-inner"},l[39]+"회"
					),
					D.div({className:"result-box-inner "+p[39]},
						D.div({className:"result-box-inner-crash"},d[39])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[40]}},
					D.div({className:"result-box-inner"},l[40]+"회"
					),
					D.div({className:"result-box-inner "+p[40]},
						D.div({className:"result-box-inner-crash"},d[40])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[41]}},
					D.div({className:"result-box-inner"},l[41]+"회"
					),
					D.div({className:"result-box-inner "+p[41]},
						D.div({className:"result-box-inner-crash"},d[41])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[42]}},
					D.div({className:"result-box-inner"},l[42]+"회"
					),
					D.div({className:"result-box-inner "+p[42]},
						D.div({className:"result-box-inner-crash"},d[42])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[43]}},
					D.div({className:"result-box-inner"},l[43]+"회"
					),
					D.div({className:"result-box-inner "+p[43]},
						D.div({className:"result-box-inner-crash"},d[43])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[44]}},
					D.div({className:"result-box-inner"},l[44]+"회"
					),
					D.div({className:"result-box-inner "+p[44]},
						D.div({className:"result-box-inner-crash"},d[44])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[45],marginRight:"5px"}},
					D.div({className:"result-box-inner"},l[45]+"회"
					),
					D.div({className:"result-box-inner "+p[45]},
						D.div({className:"result-box-inner-crash"},d[45])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[46]}},
					D.div({className:"result-box-inner"},l[46]+"회"
					),
					D.div({className:"result-box-inner "+p[46]},
						D.div({className:"result-box-inner-crash"},d[46])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[47]}},
					D.div({className:"result-box-inner"},l[47]+"회"
					),
					D.div({className:"result-box-inner "+p[47]},
						D.div({className:"result-box-inner-crash"},d[47])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[48]}},
					D.div({className:"result-box-inner"},l[48]+"회"
					),
					D.div({className:"result-box-inner "+p[48]},
						D.div({className:"result-box-inner-crash"},d[48])
					)
				),
				D.div({className:"result-box",style:{width:c,display:h[49]}},
					D.div({className:"result-box-inner"},l[49]+"회"
					),
					D.div({className:"result-box-inner "+p[49]},
						D.div({className:"result-box-inner-crash"},d[49])
					)
				)
			):null
			*/

            return D.div({ id: 'chart-controls-inner-container', className: this.props.controlsSize },
                D.div({ id: 'chart-container', className: this.props.controlsSize },
                    GraphicsContainer({
                        isMobileOrSmall: this.props.isMobileOrSmall,
                        controlsSize: this.props.controlsSize
                    })
                ),
                D.div({ id: 'controls-container', className: this.props.controlsSize },
                    ControlsSelector({
                        isMobileOrSmall: this.props.isMobileOrSmall,
                        controlsSize: this.props.controlsSize
                    })
                )
            );
        }
    });
});