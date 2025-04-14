import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import axios from 'axios';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    // https://socket.io/docs/v4/tutorial/step-6
    connectionStateRecovery: {},
});

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize letter distribution
const initialLetterDistribution = new Map([
    ['A', 13], ['B', 3], ['C', 3], ['D', 6], ['E', 18],
    ['F', 3], ['G', 4], ['H', 3], ['I', 12], ['J', 2],
    ['K', 2], ['L', 5], ['M', 3], ['N', 8], ['O', 11],
    ['P', 3], ['Q', 2], ['R', 9], ['S', 6], ['T', 9],
    ['U', 6], ['V', 3], ['W', 3], ['X', 2], ['Y', 3],
    ['Z', 2]
]);

// Calculate total letters
const totalLetters = Array.from(initialLetterDistribution.values()).reduce((sum, count) => sum + count, 0);

// Game state
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

const gameState: GameState = {
    players: [],
    centerLetters: [],
    currentPlayer: null,
    letterPool: new Map(initialLetterDistribution),
    gameOver: false,
    winner: null,
    totalLetters: totalLetters
};

// Dictionary API URL
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Function to validate if a word exists in the dictionary
async function isValidWord(word: string): Promise<boolean> {
    try {
        const response = await axios.get(`${DICTIONARY_API_URL}${word.toLowerCase()}`);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Function to get a random letter from the remaining pool
function getRandomLetter(): string | null {
    // Get total remaining letters
    const totalRemaining = Array.from(gameState.letterPool.values())
        .reduce((sum, count) => sum + count, 0);

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
    const totalRemaining = Array.from(gameState.letterPool.values())
        .reduce((sum, count) => sum + count, 0);

    if (totalRemaining === 0) {
        gameState.gameOver = true;
        
        // Calculate scores (total letters in words)
        const scores = gameState.players.map(player => ({
            id: player.id,
            name: player.name,
            score: player.words.reduce((sum, word) => sum + word.length, 0)
        }));

        // Find player with highest score
        const winner = scores.reduce((prev, current) => 
            (prev.score > current.score) ? prev : current
        );

        gameState.winner = winner.name;
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle player joining
    socket.on('joinGame', (playerName: string) => {
        const newPlayer: Player = {
            id: socket.id,
            name: playerName,
            words: []
        };
        gameState.players.push(newPlayer);
        
        if (gameState.players.length === 1) {
            gameState.currentPlayer = socket.id;
        }

        io.emit('gameState', gameState);
    });

    // Handle letter flip
    socket.on('flipLetter', () => {
        if (socket.id !== gameState.currentPlayer) return;

        const newLetter = getRandomLetter();
        if (newLetter === null) {
            checkGameOver();
            io.emit('gameState', gameState);
            return;
        }

        gameState.centerLetters.push(newLetter);

        // Move to next player
        const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentPlayer);
        gameState.currentPlayer = gameState.players[(currentIndex + 1) % gameState.players.length].id;

        io.emit('gameState', gameState);
    });

    // Handle word claim
    socket.on('claimWord', async (word: string) => {
        if (word.length < 3 || gameState.gameOver) {
            socket.emit('error', 'Word must be at least 3 letters long');
            return;
        }

        const player = gameState.players.find(p => p.id === socket.id);
        if (!player) return;

        // Check if word is valid
        const isValid = await isValidWord(word);
        if (!isValid) {
            socket.emit('error', 'Not a valid English word');
            return;
        }

        // Check if word can be formed from center letters
        const tempLetters = [...gameState.centerLetters];
        const canFormWord = word.split('').every(letter => {
            const index = tempLetters.indexOf(letter);
            if (index === -1) return false;
            tempLetters.splice(index, 1);
            return true;
        });

        if (canFormWord) {
            player.words.push(word);
            gameState.centerLetters = tempLetters;
            io.emit('gameState', gameState);
        } else {
            socket.emit('error', 'Cannot form word from available letters');
        }
    });

    // Handle word steal
    socket.on('stealWord', async (targetPlayerId: string, targetWord: string, newWord: string) => {
        if (gameState.gameOver) return;

        const stealingPlayer = gameState.players.find(p => p.id === socket.id);
        const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
        
        if (!stealingPlayer || !targetPlayer) return;

        const wordIndex = targetPlayer.words.indexOf(targetWord);
        if (wordIndex === -1) return;

        // Check if new word is valid
        const isValid = await isValidWord(newWord);
        if (!isValid) {
            socket.emit('error', 'Not a valid English word');
            return;
        }

        // Check if the new word is just a simple modification of the original word
        const commonSuffixes = ['s', 'es', 'ing', 'ed', 'er', 'est', 'ly', 'ness', 'ment', 'tion'];
        const isSimpleModification = commonSuffixes.some(suffix => {
            // Check if new word is just the original word + suffix
            if (newWord.toLowerCase() === targetWord.toLowerCase() + suffix) return true;
            // Check if new word is just the original word with last letter replaced by suffix
            if (newWord.toLowerCase() === targetWord.toLowerCase().slice(0, -1) + suffix) return true;
            return false;
        });

        if (isSimpleModification) {
            socket.emit('error', 'Cannot just add common suffixes to the original word');
            return;
        }

        // Get all available letters (center letters + target word letters)
        const availableLetters = [...gameState.centerLetters, ...targetWord.split('')];
        
        // Check if the new word can be formed from available letters
        const tempLetters = [...availableLetters];
        const canFormWord = newWord.split('').every(letter => {
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
            newWord.split('').forEach(letter => {
                const centerIndex = remainingLetters.indexOf(letter);
                if (centerIndex !== -1) {
                    remainingLetters.splice(centerIndex, 1);
                }
            });

            // For any letters in the new word that weren't in the center,
            // remove them from the stolen word's letters
            const stolenWordLetters = targetWord.split('');
            newWord.split('').forEach(letter => {
                const stolenIndex = stolenWordLetters.indexOf(letter);
                if (stolenIndex !== -1) {
                    stolenWordLetters.splice(stolenIndex, 1);
                }
            });

            // Add any unused letters from the stolen word back to the center
            remainingLetters.push(...stolenWordLetters);
            
            gameState.centerLetters = remainingLetters;
            io.emit('gameState', gameState);
        } else {
            socket.emit('error', 'Cannot form word from available letters');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameState.players = gameState.players.filter(p => p.id !== socket.id);
        if (gameState.currentPlayer === socket.id) {
            gameState.currentPlayer = gameState.players[0]?.id || null;
        }
        io.emit('gameState', gameState);
    });

    // Handle game restart
    socket.on('restartGame', () => {
        // Reset game state
        gameState.players = [];
        gameState.centerLetters = [];
        gameState.currentPlayer = null;
        gameState.letterPool = new Map(initialLetterDistribution);
        gameState.gameOver = false;
        gameState.winner = null;
        io.emit('gameState', gameState);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});