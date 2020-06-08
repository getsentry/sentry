export enum RuleType {
  PATTERN = 'pattern',
  CREDITCARD = 'creditcard',
  PASSWORD = 'password',
  IP = 'ip',
  IMEI = 'imei',
  EMAIL = 'email',
  UUID = 'uuid',
  PEMKEY = 'pemkey',
  URLAUTH = 'urlauth',
  USSSN = 'usssn',
  USER_PATH = 'userpath',
  MAC = 'mac',
  ANYTHING = 'anything',
}

export enum MethodType {
  MASK = 'mask',
  REMOVE = 'remove',
  HASH = 'hash',
  REPLACE = 'replace',
}

export enum EventIdStatus {
  LOADING = 'loading',
  INVALID = 'invalid',
  NOT_FOUND = 'not_found',
  LOADED = 'loaded',
  ERROR = 'error',
}

export enum SourceSuggestionType {
  VALUE = 'value',
  UNARY = 'unary',
  BINARY = 'binary',
  STRING = 'string',
}

export enum RequestError {
  Unknown = 'unknown',
  InvalidSelector = 'invalid-selector',
  RegexParse = 'regex-parse',
}

export type SourceSuggestion = {
  type: SourceSuggestionType;
  value: string;
  description?: string;
  examples?: Array<string>;
};

type RuleBase = {
  id: number;
  method: MethodType;
  source: string;
};

export type RuleRegex = {
  type: RuleType.PATTERN;
  pattern: string;
} & RuleBase;

export type RuleWithoutRegex = {
  type:
    | RuleType.CREDITCARD
    | RuleType.PASSWORD
    | RuleType.IP
    | RuleType.IMEI
    | RuleType.EMAIL
    | RuleType.UUID
    | RuleType.PEMKEY
    | RuleType.URLAUTH
    | RuleType.USSSN
    | RuleType.USER_PATH
    | RuleType.MAC
    | RuleType.ANYTHING;
} & RuleBase;

export type Rule = RuleRegex | RuleWithoutRegex;

export type KeysOfUnion<T> = T extends any ? keyof T : never;

export type EventId = {
  value: string;
  status?: EventIdStatus;
};

type PiiConfigBase = {
  redaction: {
    method: MethodType;
  };
};

type PiiConfigRegex = Pick<RuleRegex, 'type'> & {
  pattern: string;
} & PiiConfigBase;

type PiiConfigWithoutRegex = Pick<RuleWithoutRegex, 'type'> & PiiConfigBase;

export type PiiConfig = PiiConfigWithoutRegex | PiiConfigRegex;

export type Applications = Record<string, Array<string>>;

export type Errors = Partial<Record<KeysOfUnion<Rule>, string>>;
