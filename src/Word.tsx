import { useEffect, useState } from "react";
import { getDefinition } from "./dictionary";

interface WordProps {
  word: string;
  onClick: () => void;
}

export function Word({ word, onClick }: WordProps) {
  const [definition, setDefinition] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const entry = await getDefinition(word);
      if (entry) {
        let content = "";
        if (entry.phonetic) {
          content += entry.phonetic + " ";
        }
        if (entry.meanings.length > 0) {
          content += "(" + entry.meanings[0].partOfSpeech + ") ";
          content += entry.meanings[0].definitions[0].definition;
        }
        setDefinition(content);
      } else {
        setDefinition("No definition found");
      }
    })();
  }, []);

  return (
    <div
      className="word"
      onClick={onClick}
      data-tooltip-id="definition-toolip"
      data-tooltip-content={definition ?? "Loading…"}
      data-tooltip-place="bottom"
    >
      {word}
    </div>
  );
}
