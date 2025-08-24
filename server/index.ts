import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // https://socket.io/docs/v4/tutorial/step-6
  connectionStateRecovery: {},
});

// Serve static files from the client directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../dist")));

// Initialize letter distribution
const initialLetterDistribution = new Map([
  ["A", 13],
  ["B", 3],
  ["C", 3],
  ["D", 6],
  ["E", 18],
  ["F", 3],
  ["G", 4],
  ["H", 3],
  ["I", 12],
  ["J", 2],
  ["K", 2],
  ["L", 5],
  ["M", 3],
  ["N", 8],
  ["O", 11],
  ["P", 3],
  ["Q", 2],
  ["R", 9],
  ["S", 6],
  ["T", 9],
  ["U", 6],
  ["V", 3],
  ["W", 3],
  ["X", 2],
  ["Y", 3],
  ["Z", 2],
]);

// Calculate total letters
const totalLetters = Array.from(initialLetterDistribution.values()).reduce(
  (sum, count) => sum + count,
  0,
);

// Game state
interface Player {
  id: string;
  name: string;
  words: string[];
  disconnectedAt?: number;
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

const gameState: GameState = {
  players: [],
  centerLetters: [],
  currentPlayer: null,
  letterPool: new Map(initialLetterDistribution),
  gameOver: false,
  winner: null,
  totalLetters: totalLetters,
};

// Dictionary API URL
const DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

// Function to validate if a word exists in the dictionary
async function isValidWord(word: string): Promise<boolean> {
  try {
    const resp = await fetch(`${DICTIONARY_API_URL}${word.toLowerCase()}`);
    return resp.status === 200;
  } catch (error) {
    return false;
  }
}

// Function to get a random letter from the remaining pool
function getRandomLetter(): string | null {
  // Get total remaining letters
  const totalRemaining = Array.from(gameState.letterPool.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  if (totalRemaining === 0) {
    return null;
  }

  // Generate random number between 0 and total remaining letters
  const randomNum = Math.floor(Math.random() * totalRemaining);

  // Use cumulative sum to select letter based on frequency
  let cumSum = 0;
  for (const [letter, count] of gameState.letterPool.entries()) {
    cumSum += count;
    if (randomNum < cumSum) {
      // Update the count
      gameState.letterPool.set(letter, count - 1);
      return letter;
    }
  }

  // This should never happen if the math is correct
  return null;
}

// Function to check if game is over and determine winner
function checkGameOver() {
  // Check if all letters are used
  const totalRemaining = Array.from(gameState.letterPool.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  if (totalRemaining === 0) {
    gameState.gameOver = true;

    // Calculate scores (total letters in words)
    const scores = gameState.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.words.reduce((sum, word) => sum + word.length, 0),
    }));

    // Find player with highest score
    const winner = scores.reduce((prev, current) =>
      prev.score > current.score ? prev : current,
    );

    gameState.winner = winner.name;
  }
}

// Function to handle turn transition if a player was removed or disconnected
function disconnectPlayer(playerId: string, remove = false) {
  if (remove) {
    gameState.players = gameState.players.filter((p) => p.id !== playerId);
  } else {
    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      player.disconnectedAt = Date.now();
    }
  }
  if (gameState.currentPlayer === playerId) {
    const connectedPlayers = gameState.players.filter((p) => !p.disconnectedAt);
    gameState.currentPlayer =
      connectedPlayers.length > 0 ? connectedPlayers[0].id : null;
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle player joining
  socket.on("joinGame", (playerName: string) => {
    // Check if player with this name was recently disconnected
    const existingPlayer = gameState.players.find((p) => p.name === playerName);

    if (existingPlayer) {
      // Reconnect existing player
      existingPlayer.id = socket.id;
      delete existingPlayer.disconnectedAt;
    } else {
      // Create new player
      const newPlayer: Player = {
        id: socket.id,
        name: playerName,
        words: [],
      };
      gameState.players.push(newPlayer);
    }

    // Give them the turn if no one else currently has it.
    if (gameState.currentPlayer === null) {
      gameState.currentPlayer = socket.id;
    }

    io.emit("gameState", gameState);
  });

  // Handle letter flip
  socket.on("flipLetter", () => {
    if (socket.id !== gameState.currentPlayer) return;

    const newLetter = getRandomLetter();
    if (newLetter === null) {
      checkGameOver();
      io.emit("gameState", gameState);
      return;
    }

    gameState.centerLetters.push(newLetter);

    // Move to next connected player
    const connectedPlayers = gameState.players.filter((p) => !p.disconnectedAt);
    const currentIndex = connectedPlayers.findIndex(
      (p) => p.id === gameState.currentPlayer,
    );

    gameState.currentPlayer =
      connectedPlayers[(currentIndex + 1) % connectedPlayers.length]?.id;

    io.emit("gameState", gameState);
  });

  // Handle word claim
  socket.on("claimWord", async (word: string) => {
    if (word.length < 3 || gameState.gameOver) {
      socket.emit("error", "Word must be at least 3 letters long");
      return;
    }

    const player = gameState.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Check if word is valid
    const isValid = await isValidWord(word);
    if (!isValid) {
      socket.emit("error", "Not a valid English word");
      return;
    }

    // Check if word can be formed from center letters
    const tempLetters = [...gameState.centerLetters];
    const canFormWord = word.split("").every((letter) => {
      const index = tempLetters.indexOf(letter);
      if (index === -1) return false;
      tempLetters.splice(index, 1);
      return true;
    });

    if (canFormWord) {
      player.words.push(word);
      gameState.centerLetters = tempLetters;
      io.emit("gameState", gameState);
    } else {
      socket.emit("error", "Cannot form word from available letters");
    }
  });

  // Handle word steal
  socket.on(
    "stealWord",
    async (targetPlayerId: string, targetWord: string, newWord: string) => {
      if (gameState.gameOver) return;

      const stealingPlayer = gameState.players.find((p) => p.id === socket.id);
      const targetPlayer = gameState.players.find(
        (p) => p.id === targetPlayerId,
      );

      if (!stealingPlayer || !targetPlayer) return;

      const wordIndex = targetPlayer.words.indexOf(targetWord);
      if (wordIndex === -1) return;

      // Check if new word is valid
      const isValid = await isValidWord(newWord);
      if (!isValid) {
        socket.emit("error", "Not a valid English word");
        return;
      }

      // Check if the new word is just a simple modification of the original word
      const commonSuffixes = [
        "s",
        "es",
        "ing",
        "ed",
        "er",
        "est",
        "ly",
        "ness",
        "ment",
        "tion",
      ];
      const isSimpleModification = commonSuffixes.some((suffix) => {
        // Check if new word is just the original word + suffix
        if (newWord.toLowerCase() === targetWord.toLowerCase() + suffix)
          return true;
        // Check if new word is just the original word with last letter replaced by suffix
        if (
          newWord.toLowerCase() ===
          targetWord.toLowerCase().slice(0, -1) + suffix
        )
          return true;
        return false;
      });

      if (isSimpleModification) {
        socket.emit(
          "error",
          "Cannot just add common suffixes to the original word",
        );
        return;
      }

      // Get all available letters (center letters + target word letters)
      const availableLetters = [
        ...gameState.centerLetters,
        ...targetWord.split(""),
      ];

      // Check if the new word can be formed from available letters
      const tempLetters = [...availableLetters];
      const canFormWord = newWord.split("").every((letter) => {
        const index = tempLetters.indexOf(letter);
        if (index === -1) return false;
        tempLetters.splice(index, 1);
        return true;
      });

      if (canFormWord) {
        // Remove the target word from the original player
        targetPlayer.words.splice(wordIndex, 1);

        // Add the new word to the stealing player
        stealingPlayer.words.push(newWord);

        // Start with current center letters
        const remainingLetters = [...gameState.centerLetters];

        // Remove letters used in the new word from center letters first
        newWord.split("").forEach((letter) => {
          const centerIndex = remainingLetters.indexOf(letter);
          if (centerIndex !== -1) {
            remainingLetters.splice(centerIndex, 1);
          }
        });

        // For any letters in the new word that weren't in the center,
        // remove them from the stolen word's letters
        const stolenWordLetters = targetWord.split("");
        newWord.split("").forEach((letter) => {
          const stolenIndex = stolenWordLetters.indexOf(letter);
          if (stolenIndex !== -1) {
            stolenWordLetters.splice(stolenIndex, 1);
          }
        });

        // Add any unused letters from the stolen word back to the center
        remainingLetters.push(...stolenWordLetters);

        gameState.centerLetters = remainingLetters;
        io.emit("gameState", gameState);
      } else {
        socket.emit("error", "Cannot form word from available letters");
      }
    },
  );

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const player = gameState.players.find((p) => p.id === socket.id);
    if (player) {
      // If player has no words, remove them completely
      disconnectPlayer(socket.id, player.words.length === 0);
    }

    io.emit("gameState", gameState);
  });

  // Handle kicking a player
  socket.on("kickPlayer", (playerIdToKick: string) => {
    const playerToKick = gameState.players.find((p) => p.id === playerIdToKick);
    if (!playerToKick) return;

    disconnectPlayer(playerIdToKick, true);

    // Disconnect the kicked player's socket if they're still connected
    const kickedSocket = io.sockets.sockets.get(playerIdToKick);
    if (kickedSocket) {
      kickedSocket.emit("kicked", "You have been kicked from the game");
      kickedSocket.disconnect();
    }

    io.emit("gameState", gameState);
  });

  // Handle game restart
  socket.on("restartGame", () => {
    // Reset game state
    gameState.players = [];
    gameState.centerLetters = [];
    gameState.currentPlayer = null;
    gameState.letterPool = new Map(initialLetterDistribution);
    gameState.gameOver = false;
    gameState.winner = null;
    io.emit("gameState", gameState);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
