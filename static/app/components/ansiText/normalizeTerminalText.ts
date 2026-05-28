export function normalizeTerminalText(text: string): string {
  return applyCarriageReturns(removeBackspaces(text));
}

function removeBackspaces(text: string): string {
  const characters: string[] = [];

  for (const character of text) {
    if (character === '\b') {
      if (characters.length > 0 && characters[characters.length - 1] !== '\n') {
        characters.pop();
      }
      continue;
    }

    characters.push(character);
  }

  return characters.join('');
}

function applyCarriageReturns(text: string): string {
  return text
    .replace(/\r+\n/g, '\n')
    .split('\n')
    .map(applyLineCarriageReturns)
    .join('\n');
}

function applyLineCarriageReturns(line: string): string {
  if (!line.includes('\r')) {
    return line;
  }

  const [firstSegment = '', ...segments] = line.split('\r');

  return segments.reduce(
    (currentLine, segment) => segment + currentLine.slice(segment.length),
    firstSegment
  );
}
