import {t} from 'app/locale';

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

const valueSuggestions: Suggestions = [
  {
    type: 'value',
    value: '$string',
    description: t('Any string value'),
  },
  {
    type: 'value',
    value: '$number',
    description: t('Any integer or float value'),
  },
  {
    type: 'value',
    value: '$datetime',
    description: t('Timestamps and dates'),
  },
  {
    type: 'value',
    value: '$array',
    description: t('Any JSON array value'),
  },
  {
    type: 'value',
    value: '$object',
    description: t('Any JSON object'),
  },
  {
    type: 'value',
    value: '$error',
    description: t('An exception instance'),
  },
  {
    type: 'value',
    value: '$stacktrace',
    description: t('A stacktrace instance'),
  },
  {
    type: 'value',
    value: '$frame',
    description: t('A stacktrace frame'),
  },
  {
    type: 'value',
    value: '$http',
    description: t('HTTP request context'),
  },
  {
    type: 'value',
    value: '$user',
    description: t('User context'),
  },
  {
    type: 'value',
    value: '$message',
    description: t('The event message'),
  },
  {
    type: 'value',
    value: '$thread',
    description: t('A thread instance'),
  },
  {
    type: 'value',
    value: '$breadcrumb',
    description: t('A breadcrumb'),
  },
  {
    type: 'value',
    value: '$span',
    description: t('A trace span'),
  },
  {
    type: 'value',
    value: '$sdk',
    description: t('SDK name and version information'),
  },
];

const initialSelectors: Suggestions = [...valueSuggestions, ...unaryOperatorSuggestions];

const allSelectors: Suggestions = [
  ...valueSuggestions,
  ...unaryOperatorSuggestions,
  ...binaryOperatorSuggestions,
];

export type SuggestionType = 'value' | 'unary' | 'binary' | 'string';

export type Suggestions = Array<Suggestion>;

export type Suggestion = {
  type: SuggestionType;
  value: string;
  description?: string;
};

export {
  initialSelectors,
  allSelectors,
  valueSuggestions,
  unaryOperatorSuggestions,
  binaryOperatorSuggestions,
};
