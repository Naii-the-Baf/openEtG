import { createSignal, onMount } from 'solid-js';
import { For } from 'solid-js/web';

import Cards from '../Cards.js';
import { addcard, encodeCount } from '../etgutil.js';
import Card from '../Components/Card.jsx';
import CardImage from '../Components/CardImage.jsx';
import ExitBtn from '../Components/ExitBtn.jsx';
import * as sock from '../sock.jsx';
import * as store from '../store.jsx';

const rewardwords = {
	mark: -1,
	pillar: 0,
	rare: 3,
	shard: 3,
	nymph: 4,
};

function getRewardList(reward) {
	if (typeof reward === 'string') {
		const shiny = reward.charAt(0) === '!';
		if (shiny) reward = reward.slice(1);
		const upped = reward.slice(0, 5) === 'upped';
		const rarity = rewardwords[upped ? reward.slice(5) : reward];
		return Cards.filter(upped, x => x.rarity === rarity).map(
			card => card.asShiny(shiny).code,
		);
	} else if (reward instanceof Array) {
		return reward;
	} else {
		return null;
	}
}

export default function Reward(props) {
	const rewardList = getRewardList(props.type);
	const [chosenReward, setChosenReward] = createSignal(null);

	onMount(() => {
		if (rewardList) {
			sock.setCmds({
				codedone: data => {
					const { user } = store.state;
					store.updateUser({
						pool: addcard(user.pool, data.card),
					});
					store.chatMsg(Cards.Codes[data.card].name + ' added!', 'System');
					store.doNav(import('./MainMenu.jsx'));
				},
			});
		} else {
			store.chatMsg(`Unknown reward ${props.type}`, 'System');
			store.doNav(import('./MainMenu.jsx'));
		}
	});

	const numberofcopies = props.amount ?? 1;
	return (
		rewardList && (
			<>
				<input
					type="button"
					value="Done"
					onClick={() => {
						if (chosenReward()) {
							if (props.code === undefined) {
								sock.userExec('addboundcards', {
									c: encodeCount(numberofcopies) + chosenReward().toString(32),
								});
								store.doNav(import('./MainMenu.jsx'));
							} else {
								sock.userEmit('codesubmit2', {
									code: props.code,
									card: chosenReward(),
								});
							}
						} else {
							store.chatMsg('Choose a reward', 'System');
						}
					}}
					style="position:absolute;left:10px;top:40px"
				/>
				{numberofcopies > 1 && (
					<div style="position:absolute;left:20px;top:100px">
						You will get {numberofcopies} copies of the card you choose
					</div>
				)}
				{!!props.code && <ExitBtn x={10} y={10} />}
				<For each={rewardList}>
					{(reward, i) => (
						<CardImage
							style={{
								position: 'absolute',
								left: `${100 + ((i() / 12) | 0) * 108}px`,
								top: `${272 + (i() % 12) * 20}px`,
							}}
							card={Cards.Codes[reward]}
							onClick={[setChosenReward, reward]}
						/>
					)}
				</For>
				<Card x={233} y={10} card={Cards.Codes[chosenReward()]} />
			</>
		)
	);
}
