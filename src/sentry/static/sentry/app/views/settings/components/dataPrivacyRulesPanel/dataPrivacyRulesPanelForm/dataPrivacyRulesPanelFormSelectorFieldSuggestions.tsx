import {t} from 'app/locale';

export type SuggestionType = 'value' | 'unary' | 'binary' | 'string';

export type Suggestion = {
  type: SuggestionType;
  value: string;
  description?: string;
};

const binaryOperatorSuggestions: Array<Suggestion> = [
  {
    type: 'binary',
    value: '&&',
  },
  {
    type: 'binary',
    value: '||',
  },
];

const unaryOperatorSuggestions: Array<Suggestion> = [
  {
    type: 'unary',
    value: '!',
  },
];

const defaultSuggestions: Array<Suggestion> = [
  {type: 'value', value: '**', description: t('everywhere')},
  {type: 'value', value: 'password', description: t('attributes named "password"')},
  {type: 'value', value: '$error.value', description: t('the exception value')},
  {type: 'value', value: '$message', description: t('the log message')},
  {
    type: 'value',
    value: 'extra.MyValue',
    description: t('the key "MyValue" in "Additional Data"'),
  },
  {
    type: 'value',
    value: 'extra.**',
    description: t('everything in "Additional Data"'),
  },
  {
    type: 'value',
    value: '$http.headers.x-custom-token',
    description: t('the X-Custom-Token HTTP header'),
  },
  {type: 'value', value: '$user.ip_address', description: t('the user IP address')},
  {
    type: 'value',
    value: '$frame.vars.foo',
    description: t('the local variable "foo"'),
  },
  {
    type: 'value',
    value: 'contexts.device.timezone',
    description: t('The timezone in the device context'),
  },
  {
    type: 'value',
    value: 'tags.server_name',
    description: t('the tag "server_name"'),
  },
];

export {unaryOperatorSuggestions, binaryOperatorSuggestions, defaultSuggestions};
