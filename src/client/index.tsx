import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';

interface Player {
    id: string;
    name: string;
    words: string[];
}

interface GameState {
    players: Player[];
    centerLetters: string[];
    currentPlayer: string | null;
    letterPool: Map<string, number>;
    gameOver: boolean;
    winner: string | null;
}

const socket = io();

function App() {
    const [playerName, setPlayerName] = useState('');
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        centerLetters: [],
        currentPlayer: null,
        letterPool: new Map(),
        gameOver: false,
        winner: null
    });
    const [isJoined, setIsJoined] = useState(false);
    const [wordToSteal, setWordToSteal] = useState<{playerId: string, word: string} | null>(null);

    useEffect(() => {
        socket.on('gameState', (newState: GameState) => {
            setGameState(newState);
        });

        socket.on('error', (errorMessage: string) => {
            alert(errorMessage);
        });

        return () => {
            socket.off('gameState');
            socket.off('error');
        };
    }, []);

    const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (playerName.trim()) {
            socket.emit('joinGame', playerName);
            setIsJoined(true);
        }
    };

    const handleFlipLetter = () => {
        socket.emit('flipLetter');
    };

    const handleClaimWord = (word: string) => {
        socket.emit('claimWord', word.toUpperCase());
    };

    const handleStealWord = (targetPlayerId: string, word: string) => {
        setWordToSteal({ playerId: targetPlayerId, word });
    };

    const handleSubmitSteal = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!wordToSteal) return;

        const form = e.currentTarget;
        const input = form.elements.namedItem('stealWord') as HTMLInputElement;
        const newWord = input.value.trim().toUpperCase();
        
        if (newWord) {
            socket.emit('stealWord', wordToSteal.playerId, wordToSteal.word, newWord);
            setWordToSteal(null);
            input.value = '';
        }
    };

    if (!isJoined) {
        return (
            <div className="join-screen">
                <h1>Pirate Bananagrams</h1>
                <form onSubmit={handleJoin}>
                    <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        required
                    />
                    <button type="submit">Join Game</button>
                </form>
            </div>
        );
    }

    if (gameState.gameOver) {
        return (
            <div className="game-over">
                <h1>Game Over!</h1>
                <h2>Winner: {gameState.winner}</h2>
                <div className="final-scores">
                    {gameState.players.map(player => (
                        <div key={player.id} className="player-score">
                            <h3>{player.name}</h3>
                            <p>Score: {player.words.reduce((sum, word) => sum + word.length, 0)}</p>
                            <p>Words: {player.words.join(', ')}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const currentPlayer = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.currentPlayer === socket.id;

    return (
        <div className="game-screen">
            <div className="game-board">
                <h2>Pirate Bananagrams</h2>
                <div className="letter-pool">
                    {gameState.centerLetters.map((letter, index) => (
                        <span key={index} className="letter">{letter}</span>
                    ))}
                </div>
                {isMyTurn && (
                    <div className="turn-actions">
                        <button onClick={handleFlipLetter}>Flip Letter</button>
                    </div>
                )}
            </div>

            <div className="players-section">
                {gameState.players.map(player => (
                    <div key={player.id} className="player-board">
                        <h3>{player.name} {player.id === socket.id ? '(You)' : ''}</h3>
                        <div className="words-list">
                            {player.words.map((word, index) => (
                                <div key={index} className="word">
                                    {word}
                                    {player.id !== socket.id && (
                                        <button onClick={() => handleStealWord(player.id, word)}>
                                            Steal
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {wordToSteal && (
                <div className="steal-word-form">
                    <h3>Steal "{wordToSteal.word}"</h3>
                    <p>Enter a new word that can be formed using the letters from "{wordToSteal.word}" plus letters from the center:</p>
                    <form onSubmit={handleSubmitSteal}>
                        <input
                            type="text"
                            name="stealWord"
                            placeholder="Enter new word"
                            minLength={wordToSteal.word.length + 1}
                            required
                        />
                        <button type="submit">Submit</button>
                        <button type="button" onClick={() => setWordToSteal(null)}>Cancel</button>
                    </form>
                </div>
            )}

            {currentPlayer && !wordToSteal && (
                <div className="word-form">
                    <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const input = form.elements.namedItem('word') as HTMLInputElement;
                        if (input.value.trim()) {
                            handleClaimWord(input.value.trim());
                            input.value = '';
                        }
                    }}>
                        <input
                            type="text"
                            name="word"
                            placeholder="Enter a word to claim"
                            minLength={3}
                        />
                        <button type="submit">Claim Word</button>
                    </form>
                </div>
            )}
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));