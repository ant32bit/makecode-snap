namespace SpriteKind {
    export const Card = SpriteKind.create();
    export const CharacterIcon = SpriteKind.create();
}

class ScoreHUD {
    private icon: Sprite;
    private score: TextSprite;
    private value: number;

    constructor(icon: Image, x: number, y: number) {
        this.value = 0

        this.icon = sprites.create(icon, SpriteKind.CharacterIcon);
        this.score = textsprite.create(this.value.toString())

        this.icon.setPosition(x, y);
        this.score.setPosition(x + 15, y);
    }

    public increment(): void {
        this.value++;
        this.score.setText(this.value.toString());
    }
}

interface IScoreboard {
    player: ScoreHUD;
    cpu: ScoreHUD;
}

class CardDeck {
    public static NoCard: number = -1;

    private cards: Image[];
    private emptyCard: Image;
    
    constructor() {
        this.cards = [
            assets.image`card-hamburger`,
            assets.image`card-chicken`,
            assets.image`card-ham`,
            assets.image`card-pizza`,
            assets.image`card-taco`,
            assets.image`card-cake`,
            assets.image`card-donut`,
            assets.image`card-icecream`,
            assets.image`card-tree`,
            assets.image`card-pillar`
        ];    
        this.emptyCard = img`.`
    }

    public cardImage(card: number): Image {
        if (card < 0 || card >= this.cards.length)
            return this.emptyCard;

        return this.cards[card];
    }

    public pickCard(exclude: number[]): number {
        exclude = this.dedupe(this.bubbleSort(exclude));
        let selectCard = randint(0, this.cards.length - exclude.length - 1);
        for (let excludeValue of exclude) {
            if (selectCard >= excludeValue) {
                selectCard++;
            }
        }
        return selectCard;
    }

    private bubbleSort (list: number[]): number[] {
        let n = list.length;
        while (true) {
            let swapped = false;
            for (let j = 0; j <= n - 1; j++) {
                if (list[j - 1] > list[j]) {
                    let temp = list[j - 1];
                    list[j - 1] = list[j];
                    list[j] = temp;
                    swapped = true;
                }
            }
            n--;
            if (!(swapped)) {
                break;
            }
        }
        return list;
    }
    
    private dedupe (list: number[]): number[] {
        let dedupedList = [list[0]];
        for (let i = 1; i < list.length; i++) {
            if (list[i] != list[i - 1]) {
                dedupedList.push(list[i]);
            }
        }
        return dedupedList;
    }
}

class GameRound {
    private static maxWaitClicks: number = 10;

    private isWaiting: boolean;
    private isSnappable: boolean;

    private remainingWaitClicks: uint8;

    public cards: number[];
    public playerReacted: boolean;

    private listeners: {
        win: () => void,
        lose: () => void,
        invalid: () => void,
    };

    constructor(card1: number, card2: number) {
        this.cards = [card1, card2]

        this.isSnappable = card1 == card2;
        this.remainingWaitClicks = this.isSnappable ?
            randint(GameRound.maxWaitClicks * 0.5, GameRound.maxWaitClicks - 1) :
            GameRound.maxWaitClicks;
        
        this.isWaiting = true;
        this.playerReacted = false;

        this.listeners = {
            win: null,
            lose: null,
            invalid: null
        };
    }

    public isEnded(): boolean {
        return !this.isWaiting;
    }

    public updateTick(): void {
        if (this.isWaiting && this.playerReacted) {
            if (this.isSnappable) {
                if (this.listeners.win != null)
                    this.listeners.win();
            }
            else {
                if (this.listeners.invalid != null)
                    this.listeners.invalid();
            }
            this.isWaiting = false;
        }
        
        if (this.remainingWaitClicks > 0)
            this.remainingWaitClicks--;
        else
            this.isWaiting = false;
        
        if (!this.isWaiting && !this.playerReacted) {
            if (this.isSnappable) {
                if (this.listeners.lose != null)
                    this.listeners.lose();
            }
        }
    }

    public addEventListener(event: 'win' | 'lose' | 'invalid', handler: () => void) {
        this.listeners[event] = handler;
    }

    public debug() {
        console.log(this.remainingWaitClicks);
    }
}

class Game {
    private static snapFrequency: number = 30

    private scoreboard: IScoreboard;
    private deck: CardDeck;
    private round: GameRound;

    private cardSprites: Sprite[];

    private jingles: music.Playable[];

    constructor() {
        scene.setBackgroundColor(7);
        this.jingles = [
            music.createSong(assets.song`jingle-win`),
            music.createSong(assets.song`jingle-lose`),
            music.createSoundEffect(WaveShape.Square, 367, 1, 255, 0, 200, SoundExpressionEffect.None, InterpolationCurve.Linear)
        ];
        
        this.scoreboard = {
            player: new ScoreHUD(assets.image`icon-player`, 10, 10),
            cpu: new ScoreHUD(assets.image`icon-cpu`, 110, 10)
        };

        this.deck = new CardDeck();

        this.cardSprites = [
            sprites.create(this.deck.cardImage(CardDeck.NoCard), SpriteKind.Card),
            sprites.create(this.deck.cardImage(CardDeck.NoCard), SpriteKind.Card)
        ];

        this.cardSprites[0].setPosition(25, 50);
        this.cardSprites[1].setPosition(110, 50);

        this.round = null;

        controller.A.onEvent(ControllerButtonEvent.Pressed, () => {
            if (this.round != null)
                this.round.playerReacted = true;
        });

        game.onUpdateInterval(100, () => {
            if (this.round != null) {
                this.round.updateTick();
                if (this.round.isEnded()) {
                    this.start();
                }
            }
        });
    }

    public start() {
        let exclude: number[] = [];
        if (this.round != null) {
            exclude.push(this.round.cards[0])
            exclude.push(this.round.cards[1])
        }

        const card1: number = this.deck.pickCard(exclude);
        let card2: number = null;
        if (randint(0, 100) <= Game.snapFrequency) {
            card2 = card1
        }
        else {
            exclude.push(card1);
            card2 = this.deck.pickCard(exclude);
        }

        this.round = new GameRound(card1, card2);
        this.round.addEventListener('win', () => this.onWin());
        this.round.addEventListener('lose', () => this.onLose());
        this.round.addEventListener('invalid', () => this.onInvalid());

        this.cardSprites[0].setImage(this.deck.cardImage(card1));
        this.cardSprites[1].setImage(this.deck.cardImage(card2));
    }

    private onWin() {
        music.play(this.jingles[0], music.PlaybackMode.InBackground);
        this.scoreboard.player.increment();
        game.showLongText("SNAP! Player wins!", DialogLayout.Bottom);
    }

    private onLose() {
        music.play(this.jingles[1], music.PlaybackMode.InBackground);
        this.scoreboard.cpu.increment();
        game.showLongText("SNAP! Computer wins!", DialogLayout.Bottom);
    }

    private onInvalid() {
        music.play(this.jingles[2], music.PlaybackMode.InBackground);
        game.showLongText("Oh no! They don't match!", DialogLayout.Bottom);
    }
}

const snap = new Game();
snap.start();
