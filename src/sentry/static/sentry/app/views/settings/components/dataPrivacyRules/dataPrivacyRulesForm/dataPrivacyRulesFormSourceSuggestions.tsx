import {t} from 'app/locale';

import {SourceSuggestion, SourceSuggestionType} from '../types';

const binaryOperatorSuggestions: Array<SourceSuggestion> = [
  {
    type: SourceSuggestionType.BINARY,
    value: '&&',
  },
  {
    type: SourceSuggestionType.BINARY,
    value: '||',
  },
];

const unaryOperatorSuggestions: Array<SourceSuggestion> = [
  {
    type: SourceSuggestionType.UNARY,
    value: '!',
  },
];

const defaultSuggestions: Array<SourceSuggestion> = [
  {type: SourceSuggestionType.VALUE, value: '**', description: t('everywhere')},
  {
    type: SourceSuggestionType.VALUE,
    value: 'password',
    description: t('attributes named "password"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$error.value',
    description: t('the exception value'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$message',
    description: t('the log message'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.MyValue',
    description: t('the key "MyValue" in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.**',
    description: t('everything in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$http.headers.x-custom-token',
    description: t('the X-Custom-Token HTTP header'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$user.ip_address',
    description: t('the user IP address'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$frame.vars.foo',
    description: t('the local variable "foo"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'contexts.device.timezone',
    description: t('the timezone in the device context'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'tags.server_name',
    description: t('the tag "server_name"'),
  },
];

export {unaryOperatorSuggestions, binaryOperatorSuggestions, defaultSuggestions};
