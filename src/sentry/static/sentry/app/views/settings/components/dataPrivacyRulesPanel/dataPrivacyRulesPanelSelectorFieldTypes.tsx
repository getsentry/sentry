const binaryOperatorSuggestions: Suggestions = [
  {
    type: 'binary',
    value: '&&',
  },
  {
    type: 'binary',
    value: '||',
  },
];

const unaryOperatorSuggestions: Suggestions = [
  {
    type: 'unary',
    value: '!',
  },
];

export type SuggestionType = 'value' | 'unary' | 'binary' | 'string';

export type Suggestions = Array<Suggestion>;

export type Suggestion = {
  type: SuggestionType;
  value: string;
  description?: string;
};

export {
  unaryOperatorSuggestions,
  binaryOperatorSuggestions,
};
