/* eslint-disable no-console */
interface Dictionary<T> {
  [index: string]: T;
}

export interface MatchResult {
  confidence: number;
  id: string;
  attributes?: string[];
}

export interface Command {
  match(input: SpeechRecognitionAlternative): MatchResult | null;
}

export class HierarchicalCommand implements Command {
  private id: string;
  private args: Dictionary<boolean>[];

  public constructor(id: string, ...args: string[][]) {
    this.id = id;
    this.args = [];
    for (let idx = 0; idx < args.length; ++idx) {
      const v = args[idx];
      const d: Dictionary<boolean> = {};
      for (let vIdx = 0; vIdx < v.length; ++vIdx) {
        d[v[vIdx]] = true;
      }
      this.args.push(d);
    }
  }

  match(input: SpeechRecognitionAlternative): MatchResult | null {
    const tokens = normalizeInput(input.transcript);
    const args: string[] = [];
    for (let idx = 0; idx < tokens.length; ++idx) {
      const matchIdx = args.length;
      if (matchIdx >= this.args.length) {
        return {id: this.id, confidence: input.confidence, attributes: args};
      }
      const token = tokens[idx];
      if (token in this.args[matchIdx]) {
        args.push(token);
      }
    }
    if (args.length === this.args.length) {
      return {id: this.id, confidence: input.confidence, attributes: args};
    }
    return null;
  }
}

export class FuzzyCommand implements Command {
  private readonly id;
  private readonly verbFirst;
  private readonly verbs: Dictionary<boolean>;
  private readonly attributes: Dictionary<boolean>;

  public constructor(
    id: string,
    verbs: string[],
    validAttributes: string[],
    verbFirst: boolean = true
  ) {
    this.id = id;
    this.verbFirst = verbFirst;
    this.verbs = {};
    for (let idx = 0; idx < verbs.length; ++idx) {
      this.verbs[verbs[idx]] = true;
    }
    this.attributes = {};
    for (let idx = 0; idx < validAttributes.length; ++idx) {
      this.attributes[validAttributes[idx]] = true;
    }
  }

  match(input: SpeechRecognitionAlternative): MatchResult | null {
    const tokens = normalizeInput(input.transcript);
    let verb: string | null = null;
    const args: string[] = [];
    for (let idx = 0; idx < tokens.length; ++idx) {
      const token = tokens[idx];
      if (verb === null) {
        if (this.verbs[token]) {
          verb = token;
        }
      }
      if (verb !== null || !this.verbFirst) {
        if (this.attributes[token]) {
          args.push(token);
        }
      }
    }
    if (verb !== null && args.length > 0) {
      return {id: this.id, confidence: input.confidence};
    }
    return null;
  }
}

export function parseVoiceCommand(
  vals: SpeechRecognitionAlternative[],
  commands: Command[]
): [MatchResult | null, SpeechRecognitionAlternative | null] {
  let highestAlternative: SpeechRecognitionAlternative | null = null;
  let highestMatch: MatchResult | null = null;
  for (let altIdx = 0; altIdx < vals.length; ++altIdx) {
    const alternative = vals[altIdx];
    console.log(alternative);
    if (highestAlternative === null) {
      highestAlternative = alternative;
    }
    if (highestMatch === null && highestAlternative.confidence < alternative.confidence) {
      highestAlternative = alternative;
    }
    for (let commandIdx = 0; commandIdx < commands.length; ++commandIdx) {
      const match = commands[commandIdx].match(alternative);
      console.log(`match processing: ${match}`);
      if (match !== null) {
        if (highestMatch === null) {
          highestMatch = match;
          highestAlternative = alternative;
        } else {
          if (highestMatch.confidence < alternative.confidence) {
            highestMatch = match;
            highestAlternative = alternative;
          }
        }
      }
    }
  }
  console.log(`highestMatch: ${highestMatch}, highestAlternative: ${highestAlternative}`);
  return [highestMatch, highestAlternative];
}

function normalizeInput(val: string): string[] {
  val = val.toLowerCase();
  val = val.replace(/[ ,;.:]+/g, ' ');
  if (val.length > 0 && val[0] === ' ') {
    val = val.substring(1);
  }
  if (val.length > 0 && val[val.length - 1] === ' ') {
    val = val.substring(0, val.length - 1);
  }
  return val.split(' ');
}
