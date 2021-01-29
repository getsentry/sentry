import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  DynamicSamplingCondition,
  DynamicSamplingConditionMultiple,
  DynamicSamplingConditionNegation,
  DynamicSamplingConditionOperator,
} from 'app/types/dynamicSampling';

import {getInnerOperatorLabel} from './utils';

type Props = {
  condition: DynamicSamplingCondition;
};

function Conditions({condition}: Props) {
  function getConvertedValue(value: Array<string>) {
    if (Array.isArray(value)) {
      return (
        <React.Fragment>
          {value.map((v, index) => (
            <React.Fragment key={v}>
              <Value>{v}</Value>
              {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }

    return <Value>{String(value)}</Value>;
  }

  switch (condition.op) {
    case DynamicSamplingConditionOperator.AND:
    case DynamicSamplingConditionOperator.OR: {
      const {inner} = condition as DynamicSamplingConditionMultiple;
      if (!inner.length) {
        return <Label>{t('All')}</Label>;
      }

      return (
        <Wrapper>
          {inner.map(({op, value}, index) => (
            <div key={index}>
              <Label>{getInnerOperatorLabel(op)}</Label>
              {getConvertedValue(value)}
            </div>
          ))}
        </Wrapper>
      );
    }
    case DynamicSamplingConditionOperator.NOT: {
      const {inner} = condition as DynamicSamplingConditionNegation;
      const {op, value} = inner;
      return (
        <div>
          <Label>{getInnerOperatorLabel(op)}</Label>
          {getConvertedValue(value)}
        </div>
      );
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('Unknown dynamic sampling condition op'));
      });
      return null; //this shall not happen
    }
  }
}

export default Conditions;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const Label = styled('span')`
  margin-right: ${space(1)};
`;

const Value = styled('span')`
  word-break: break-all;
  white-space: pre-wrap;
  color: ${p => p.theme.gray300};
`;

const Separator = styled(Value)`
  padding-right: ${space(0.5)};
`;
