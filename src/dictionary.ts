const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const DEFINITION_CACHE: Map<string, DictionaryEntry> = new Map();

export type DictionaryEntry = {
    word: string;
    phonetic: string;
    phonetics: {
        text: string;
        audio: string;
    }[];
    meanings: {
        partOfSpeech: string;
        definitions: {
            definition: string;
            synonyms: string[];
            antonyms: string[];
        }[];
        synonyms: string[];
        antonyms: string[];
    }[];
    license: {
        name: string;
        url: string;
    };
    sourceUrls: string[];
};

export async function getDefinition(word: string): Promise<DictionaryEntry | null> {
    word = word.toLowerCase();
    if (DEFINITION_CACHE.has(word)) {
        return DEFINITION_CACHE.get(word)!;
    }

    try {
        const resp = await fetch(`${DICTIONARY_API_URL}${word.toLowerCase()}`);
        if (!resp.ok || resp.status !== 200) {
            return null;
        }
        const data: DictionaryEntry[] = await resp.json();
        if (data.length === 0) {
            return null;
        }
        DEFINITION_CACHE.set(word, data[0]);
        return data[0];
    } catch (error) {
        return null;
    }
}