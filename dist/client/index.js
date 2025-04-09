"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const react_dom_1 = __importDefault(require("react-dom"));
const socket_io_client_1 = require("socket.io-client");
const socket = (0, socket_io_client_1.io)();
function App() {
    const [playerName, setPlayerName] = (0, react_1.useState)('');
    const [gameState, setGameState] = (0, react_1.useState)({
        players: [],
        centerLetters: [],
        currentPlayer: null,
        letterPool: new Map(),
        gameOver: false,
        winner: null
    });
    const [isJoined, setIsJoined] = (0, react_1.useState)(false);
    const [wordToSteal, setWordToSteal] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        socket.on('gameState', (newState) => {
            setGameState(newState);
        });
        socket.on('error', (errorMessage) => {
            alert(errorMessage);
        });
        return () => {
            socket.off('gameState');
            socket.off('error');
        };
    }, []);
    const handleJoin = (e) => {
        e.preventDefault();
        if (playerName.trim()) {
            socket.emit('joinGame', playerName);
            setIsJoined(true);
        }
    };
    const handleFlipLetter = () => {
        socket.emit('flipLetter');
    };
    const handleClaimWord = (word) => {
        socket.emit('claimWord', word.toUpperCase());
    };
    const handleStealWord = (targetPlayerId, word) => {
        setWordToSteal({ playerId: targetPlayerId, word });
    };
    const handleSubmitSteal = (e) => {
        e.preventDefault();
        if (!wordToSteal)
            return;
        const form = e.currentTarget;
        const input = form.elements.namedItem('stealWord');
        const newWord = input.value.trim().toUpperCase();
        if (newWord) {
            socket.emit('stealWord', wordToSteal.playerId, wordToSteal.word, newWord);
            setWordToSteal(null);
            input.value = '';
        }
    };
    if (!isJoined) {
        return (react_1.default.createElement("div", { className: "join-screen" },
            react_1.default.createElement("h1", null, "Pirate Bananagrams"),
            react_1.default.createElement("form", { onSubmit: handleJoin },
                react_1.default.createElement("input", { type: "text", value: playerName, onChange: (e) => setPlayerName(e.target.value), placeholder: "Enter your name", required: true }),
                react_1.default.createElement("button", { type: "submit" }, "Join Game"))));
    }
    if (gameState.gameOver) {
        return (react_1.default.createElement("div", { className: "game-over" },
            react_1.default.createElement("h1", null, "Game Over!"),
            react_1.default.createElement("h2", null,
                "Winner: ",
                gameState.winner),
            react_1.default.createElement("div", { className: "final-scores" }, gameState.players.map(player => (react_1.default.createElement("div", { key: player.id, className: "player-score" },
                react_1.default.createElement("h3", null, player.name),
                react_1.default.createElement("p", null,
                    "Score: ",
                    player.words.reduce((sum, word) => sum + word.length, 0)),
                react_1.default.createElement("p", null,
                    "Words: ",
                    player.words.join(', '))))))));
    }
    const currentPlayer = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.currentPlayer === socket.id;
    return (react_1.default.createElement("div", { className: "game-screen" },
        react_1.default.createElement("div", { className: "game-board" },
            react_1.default.createElement("h2", null, "Pirate Bananagrams"),
            react_1.default.createElement("div", { className: "letter-pool" }, gameState.centerLetters.map((letter, index) => (react_1.default.createElement("span", { key: index, className: "letter" }, letter)))),
            isMyTurn && (react_1.default.createElement("div", { className: "turn-actions" },
                react_1.default.createElement("button", { onClick: handleFlipLetter }, "Flip Letter")))),
        react_1.default.createElement("div", { className: "players-section" }, gameState.players.map(player => (react_1.default.createElement("div", { key: player.id, className: "player-board" },
            react_1.default.createElement("h3", null,
                player.name,
                " ",
                player.id === socket.id ? '(You)' : ''),
            react_1.default.createElement("div", { className: "words-list" }, player.words.map((word, index) => (react_1.default.createElement("div", { key: index, className: "word" },
                word,
                player.id !== socket.id && (react_1.default.createElement("button", { onClick: () => handleStealWord(player.id, word) }, "Steal")))))))))),
        wordToSteal && (react_1.default.createElement("div", { className: "steal-word-form" },
            react_1.default.createElement("h3", null,
                "Steal \"",
                wordToSteal.word,
                "\""),
            react_1.default.createElement("p", null,
                "Enter a new word that can be formed using the letters from \"",
                wordToSteal.word,
                "\" plus letters from the center:"),
            react_1.default.createElement("form", { onSubmit: handleSubmitSteal },
                react_1.default.createElement("input", { type: "text", name: "stealWord", placeholder: "Enter new word", minLength: wordToSteal.word.length + 1, required: true }),
                react_1.default.createElement("button", { type: "submit" }, "Submit"),
                react_1.default.createElement("button", { type: "button", onClick: () => setWordToSteal(null) }, "Cancel")))),
        currentPlayer && !wordToSteal && (react_1.default.createElement("div", { className: "word-form" },
            react_1.default.createElement("form", { onSubmit: (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const input = form.elements.namedItem('word');
                    if (input.value.trim()) {
                        handleClaimWord(input.value.trim());
                        input.value = '';
                    }
                } },
                react_1.default.createElement("input", { type: "text", name: "word", placeholder: "Enter a word to claim", minLength: 3 }),
                react_1.default.createElement("button", { type: "submit" }, "Claim Word"))))));
}
react_dom_1.default.render(react_1.default.createElement(App, null), document.getElementById('root'));
