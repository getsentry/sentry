import styled from '@emotion/styled';

import type {SuggestionSection} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';
import {
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconArrow} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const RELATIVE_DATE_INPUT_REGEX = /^(\d+)\s*([mhdw]?)/;
const RELATIVE_DATE_UNITS = ['m', 'h', 'd', 'w'] as const;

export function getDefaultAbsoluteDateValue(token: TokenResult<Token.FILTER>) {
  if (token.value.type === Token.VALUE_ISO_8601_DATE) {
    return token.value.text;
  }

  return '';
}

function getRelativeDateSign(token: TokenResult<Token.FILTER>) {
  if (token.value.type === Token.VALUE_ISO_8601_DATE) {
    switch (token.operator) {
      case TermOperator.LESS_THAN:
      case TermOperator.LESS_THAN_EQUAL:
        return '+';
      default:
        return '-';
    }
  }

  if (token.value.type === Token.VALUE_RELATIVE_DATE) {
    return token.value.sign;
  }

  return '-';
}

function makeRelativeDateDescription(value: number, unit: string) {
  switch (unit) {
    case 's':
      return tn('%s second ago', '%s seconds ago', value);
    case 'm':
      return tn('%s minute ago', '%s minutes ago', value);
    case 'h':
      return tn('%s hour ago', '%s hours ago', value);
    case 'd':
      return tn('%s day ago', '%s days ago', value);
    case 'w':
      return tn('%s week ago', '%s weeks ago', value);
    default:
      return '';
  }
}

function makeDefaultDateSuggestions(
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  const sign = getRelativeDateSign(token);

  return [
    {
      sectionText: '',
      suggestions: [
        {value: `${sign}1h`, label: makeRelativeDateDescription(1, 'h')},
        {value: `${sign}24h`, label: makeRelativeDateDescription(24, 'h')},
        {value: `${sign}7d`, label: makeRelativeDateDescription(7, 'd')},
        {value: `${sign}14d`, label: makeRelativeDateDescription(14, 'd')},
        {value: `${sign}30d`, label: makeRelativeDateDescription(30, 'd')},
        {
          value: 'absolute_date',
          label: (
            <AbsoluteDateOption>
              {t('Absolute date')}
              <IconArrow direction="right" size="xs" />
            </AbsoluteDateOption>
          ),
        },
      ],
    },
  ];
}

export function getRelativeDateSuggestions(
  inputValue: string,
  token: TokenResult<Token.FILTER>
): SuggestionSection[] {
  const match = inputValue.match(RELATIVE_DATE_INPUT_REGEX);

  if (!match) {
    return makeDefaultDateSuggestions(token);
  }

  const [, value] = match;
  const intValue = parseInt(value!, 10);

  if (isNaN(intValue)) {
    return makeDefaultDateSuggestions(token);
  }

  const sign = token.value.type === Token.VALUE_RELATIVE_DATE ? token.value.sign : '-';

  return [
    {
      sectionText: '',
      suggestions: RELATIVE_DATE_UNITS.map(unit => {
        return {
          value: `${sign}${intValue}${unit}`,
          label: makeRelativeDateDescription(intValue, unit),
        };
      }),
    },
  ];
}

const AbsoluteDateOption = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;

  svg {
    color: ${p => p.theme.gray300};
  }
`;
