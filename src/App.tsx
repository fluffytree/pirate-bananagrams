import { useState, useEffect, FormEvent } from "react";
import { io } from "socket.io-client";
import { Tooltip } from "react-tooltip";
import { Word } from "./Word";

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
  totalLetters: number;
}

const socket = io();

export function App() {
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    centerLetters: [],
    currentPlayer: null,
    letterPool: new Map(),
    gameOver: false,
    winner: null,
    totalLetters: 0,
  });
  const [isJoined, setIsJoined] = useState(false);
  const [wordToSteal, setWordToSteal] = useState<{
    playerId: string;
    word: string;
  } | null>(null);
  const [flipTimer, setFlipTimer] = useState<number>(30);

  useEffect(() => {
    socket.on("gameState", (newState: GameState) => {
      setGameState(newState);
      if (newState.currentPlayer !== gameState.currentPlayer) {
        setFlipTimer(30);
      }
    });

    socket.on("error", (errorMessage: string) => {
      alert(errorMessage);
    });

    return () => {
      socket.off("gameState");
      socket.off("error");
    };
  }, [gameState.currentPlayer]);

  useEffect(() => {
    let interval = 0;
    if (gameState.currentPlayer === socket.id && flipTimer > 0) {
      interval = window.setInterval(() => {
        setFlipTimer((prev) => {
          if (prev <= 1) {
            socket.emit("flipLetter");
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.currentPlayer, flipTimer]);

  const handleJoin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (playerName.trim()) {
      socket.emit("joinGame", playerName);
      setIsJoined(true);
    }
  };

  const handleFlipLetter = () => {
    socket.emit("flipLetter");
  };

  const handleClaimWord = (word: string) => {
    socket.emit("claimWord", word.toUpperCase());
  };

  const handleStealWord = (targetPlayerId: string, word: string) => {
    setWordToSteal({ playerId: targetPlayerId, word });
  };

  const handleSubmitSteal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wordToSteal) return;

    const form = e.currentTarget;
    const input = form.elements.namedItem("stealWord") as HTMLInputElement;
    const newWord = input.value.trim().toUpperCase();

    if (newWord) {
      socket.emit("stealWord", wordToSteal.playerId, wordToSteal.word, newWord);
      setWordToSteal(null);
      input.value = "";
    }
  };

  const handleRestartGame = () => {
    socket.emit("restartGame");
    setIsJoined(false);
    setPlayerName("");
  };

  if (!isJoined) {
    return (
      <div className="join-screen">
        <h1>Pirate Bananagrams</h1>
        <form className="input-group" onSubmit={handleJoin}>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            required
          />
          <button type="submit">
            Join<span className="mobile-hidden"> Game</span>
          </button>
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
          {gameState.players.map((player) => (
            <div key={player.id} className="player-score">
              <h3>{player.name}</h3>
              <p>
                Score:{" "}
                {player.words.reduce((sum, word) => sum + word.length, 0)}
              </p>
              <p>Words: {player.words.join(", ")}</p>
            </div>
          ))}
        </div>
        <button onClick={handleRestartGame} className="restart-button">
          Start New Game
        </button>
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.id === socket.id);
  const isMyTurn = gameState.currentPlayer === socket.id;

  return (
    <div className="game-screen">
      <div className="game-board">
        <h2>Pirate Bananagrams</h2>
        <div className="letter-pool">
          {gameState.centerLetters.map((letter, index) => (
            <span key={index} className="letter">
              {letter}
            </span>
          ))}
        </div>
        {isMyTurn && (
          <div className="turn-actions">
            <button onClick={handleFlipLetter}>
              Flip Letter ({flipTimer}s)
            </button>
          </div>
        )}
      </div>

      <div className="players-section">
        {gameState.players.map((player) => (
          <div key={player.id} className="player-board">
            <h3
              className={
                gameState.currentPlayer === player.id ? "current-player" : ""
              }
            >
              {player.name}
            </h3>
            <div className="words-list">
              {player.words.map((word, index) => (
                <Word
                  key={index}
                  word={word}
                  onClick={() => handleStealWord(player.id, word)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {wordToSteal && (
        <div className="steal-word-form">
          <h3>Steal "{wordToSteal.word}"</h3>
          <p>
            Enter a new word that can be formed using the letters from "
            {wordToSteal.word}" plus letters from the center:
          </p>
          <form className="input-group" onSubmit={handleSubmitSteal}>
            <input
              type="text"
              name="stealWord"
              placeholder="Enter new word"
              minLength={wordToSteal.word.length + 1}
              required
              className="uppercase"
              autoComplete="off"
              autoFocus
            />
            <button type="submit">Submit</button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setWordToSteal(null)}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {currentPlayer && !wordToSteal && (
        <div className="word-form">
          <form
            className="input-group"
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem("word") as HTMLInputElement;
              if (input.value.trim()) {
                handleClaimWord(input.value.trim());
                input.value = "";
              }
            }}
          >
            <input
              type="text"
              name="word"
              placeholder="Enter a word to claim"
              minLength={3}
              className="uppercase"
              autoComplete="off"
            />
            <button type="submit">
              Claim<span className="mobile-hidden"> Word</span>
            </button>
          </form>
        </div>
      )}

      <Tooltip
        id="definition-toolip"
        style={{ maxWidth: "40ch", textAlign: "center" }}
      />
    </div>
  );
}
