import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  DynamicSamplingCondition,
  DynamicSamplingConditionLogicalInner,
  DynamicSamplingConditionOperator,
} from 'app/types/dynamicSampling';

import {getInnerNameLabel} from './utils';

type Props = {
  condition: DynamicSamplingCondition;
};

function Conditions({condition}: Props) {
  function getConvertedValue(value: DynamicSamplingConditionLogicalInner['value']) {
    if (Array.isArray(value)) {
      return (
        <Fragment>
          {[...value].map((v, index) => (
            <Fragment key={v}>
              <Value>{v}</Value>
              {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
            </Fragment>
          ))}
        </Fragment>
      );
    }

    return <Value>{String(value)}</Value>;
  }

  switch (condition.op) {
    case DynamicSamplingConditionOperator.AND: {
      const {inner} = condition;
      if (!inner.length) {
        return <Label>{t('All')}</Label>;
      }

      return (
        <Wrapper>
          {inner.map(({value, name}, index) => (
            <div key={index}>
              <Label>{getInnerNameLabel(name)}</Label>
              {getConvertedValue(value)}
            </div>
          ))}
        </Wrapper>
      );
    }
    default: {
      Sentry.captureException(new Error('Unknown dynamic sampling condition operator'));
      return null; // this shall not happen
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
