const options = require('./options'),
	Text = require('./Components'),
	React = require('react'),
	h = React.createElement;

exports.Tutor = class Tutor extends React.Component {
	constructor(props) {
		super(props);
		this.state = { showtut: false };
	}

	render() {
		if (options.disableTut) return null;
		const tutdata = this.props.data;
		const tutbtn = (
			<span
				className="imgb ico e13"
				onMouseEnter={() => {
					this.setState({ showtut: true });
				}}
				onMouseLeave={() => {
					this.setState({ showtut: false });
				}}
				style={{
					position: 'absolute',
					left: this.props.x + 'px',
					top: this.props.y + 'px',
				}}
			/>
		);
		const children = [tutbtn];
		if (this.state.showtut) {
			children.push(<div className="tutorialbg" />);
			children.push(
				<div
					children={tutdata.map(info => {
						const style = {
							position: 'absolute',
							left: info[0] + 'px',
							top: info[1] + 'px',
						};
						if (info.length > 2) style.width = info[2] + 'px';
						if (info.length > 3) style.height = info[3] + 'px';
						return <Text
							className='tutorialbox'
							text={info[info.length - 1]}
							style={style}
						/>;
					})}
				/>,
			);
		}
		return <div children={children} />;
	}
};
exports.Editor = [
	[
		100,
		32,
		624,
		'Here the deck you are building shows up. Use the buttons to the left to save & load your deck:' +
			'\nClear: Erase this deck\nSave & Exit: Save the current deck & return to the main menu\nImport: Import a deck code from the import box\nSave: Save the current deck to the name in the name box in the top left' +
			'\nLoad: Load the deck with the name you have typed in the name box in the top left\nSave to #: Save the current deck & name to one of the quickload slots\nTip: Use one of the quickdeck buttons as a "New Deck" button, & then save any decks you make there to a proper name',
	],
	[
		298,
		6,
		426,
		'Clicking a quickload slot will instantly load the deck saved there',
	],
	[
		100,
		232,
		418,
		'Choose a mark. You will gain 1 quantum per turn of that element. Mark of Chroma gives 3 random quanta.',
	],
	[520, 236, 'The import box shows the deck code of the deck'],
	[
		2,
		350,
		250,
		100,
		'Click the element buttons to show cards of that element.\nThe rarity filters will only show cards of that rarity, except pillar filter which will show all cards.',
	],
	[
		300,
		350,
		320,
		'Clicking a card will add it to your deck. A number after a / shows how many shiny cards you have.',
	],
	[80, 530, ": Shows all cards, including those you don't own"],
	[80, 575, ": Don't show shiny cards"],
];
exports.Shop = [
	[
		45,
		97,
		520,
		158,
		'1) Select the element of the pack you want to buy.\nEach card in the pack has a 50% chance of being the element you choose.\nRandom pack means the cards is completely random instead.',
	],
	[
		45,
		275,
		610,
		158,
		'2) Select the type of pack you want.\nYou will see the amount of cards & rarity of each pack in the upper box.',
	],
	[
		590,
		97,
		260,
		158,
		'3) Buy the pack you selected!\nIf you want to buy many packs at once, type in the Bulk box how many you want.\nIn chat you will see a link to a deck code with the cards you got.',
	],
];
