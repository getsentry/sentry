export enum RuleType {
  PATTERN = 'pattern',
  CREDITCARD = 'creditcard',
  PASSWORD = 'password',
  IP = 'ip',
  IMEI = 'imei',
  EMAIL = 'email',
  UUID = 'uuid',
  PEMKEY = 'pemkey',
  URLAUTH = 'url_auth',
  USSSN = 'us_ssn',
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
  UNDEFINED = 'undefined',
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

export type SourceSuggestion = {
  type: SourceSuggestionType;
  value: string;
  description?: string;
  examples?: Array<string>;
};

type RuleBase = {
  id: number;
  source: string;
};

export type RuleDefault = RuleBase & {
  method: MethodType.MASK | MethodType.REMOVE | MethodType.HASH;
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
};

export type RulePattern = RuleBase & {
  pattern: string;
  type: RuleType.PATTERN;
} & Pick<RuleDefault, 'method'>;

export type RuleReplace = RuleBase & {
  method: MethodType.REPLACE;
  placeholder?: string;
} & Pick<RuleDefault, 'type'>;

export type KeysOfUnion<T> = T extends any ? keyof T : never;

export type RuleReplaceAndPattern = Omit<RulePattern, 'method'> &
  Omit<RuleReplace, 'type'>;

export type Rule = RuleDefault | RuleReplace | RulePattern | RuleReplaceAndPattern;

export type EventId = {
  status: EventIdStatus;
  value: string;
};

type PiiConfigDefault = {
  redaction: {
    method: RuleDefault['method'];
  };
  type: RuleDefault['type'];
};

type PiiConfigReplace = {
  redaction: {
    method: RuleReplace['method'];
    text?: string;
  };
  type: RuleReplace['type'];
};

type PiiConfigPattern = {
  pattern: string;
  redaction: {
    method: RulePattern['method'];
  };
  type: RulePattern['type'];
};

type PiiConfigReplaceAndPattern = Omit<PiiConfigPattern, 'redaction'> &
  Pick<PiiConfigReplace, 'redaction'>;

export type PiiConfig =
  | PiiConfigDefault
  | PiiConfigPattern
  | PiiConfigReplace
  | PiiConfigReplaceAndPattern;

export type Applications = Record<string, Array<string>>;

export type Errors = Partial<Record<KeysOfUnion<Rule>, string>>;
