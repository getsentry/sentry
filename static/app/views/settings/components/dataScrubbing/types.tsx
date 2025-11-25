import type {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';

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
  examples?: string[];
};

export type AttributeSuggestion = {
  label: string;
  value: string; // Hidden from the user.
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

type RulePattern = RuleBase & {
  pattern: string;
  replaceCaptured: boolean;
  type: RuleType.PATTERN;
} & Pick<RuleDefault, 'method'>;

type RuleReplace = RuleBase & {
  method: MethodType.REPLACE;
  placeholder?: string;
} & Pick<RuleDefault, 'type'>;

export type KeysOfUnion<T> = T extends any ? keyof T : never;

type RuleReplaceAndPattern = Omit<RulePattern, 'method'> & Omit<RuleReplace, 'type'>;

export type Rule = RuleDefault | RuleReplace | RulePattern | RuleReplaceAndPattern;

export type EventId = {
  status: EventIdStatus;
  value: string;
};

export type EditableRule = Omit<
  {
    [K in KeysOfUnion<Rule>]: K extends 'replaceCaptured' ? boolean : string;
  },
  'id'
>;

export type AttributeResults = Record<
  AllowedDataScrubbingDatasets,
  ReturnType<typeof useTraceItemAttributeKeys> | null
>;

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
  replaceGroups?: number[];
};

type PiiConfigReplaceAndPattern = Omit<PiiConfigPattern, 'redaction'> &
  Pick<PiiConfigReplace, 'redaction'>;

export enum AllowedDataScrubbingDatasets {
  // This is the default dataset that is used for data scrubbing. When this is selected, the user will be shown the old 'source' field.
  DEFAULT = 'default',
  // This is the dataset that is used for data scrubbing. When this is selected, the user will be shown a trace item attribute picker.
  LOGS = 'logs',
}

export type PiiConfig =
  | PiiConfigDefault
  | PiiConfigPattern
  | PiiConfigReplace
  | PiiConfigReplaceAndPattern;

export type Applications = Record<string, string[]>;
