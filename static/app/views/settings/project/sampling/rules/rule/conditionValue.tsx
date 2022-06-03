import {Fragment} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {SamplingConditionLogicalInner} from 'sentry/types/sampling';

import {LEGACY_BROWSER_LIST} from '../../utils';

type Props = {
  value: SamplingConditionLogicalInner['value'];
};

export function ConditionValue({value}: Props) {
  if (Array.isArray(value)) {
    return (
      <div>
        {[...value].map((v, index) => (
          <Fragment key={v}>
            <Value>{LEGACY_BROWSER_LIST[v]?.title ?? v}</Value>
            {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
          </Fragment>
        ))}
      </div>
    );
  }

  return <Value>{LEGACY_BROWSER_LIST[String(value)]?.title ?? String(value)}</Value>;
}

const Value = styled('span')`
  word-break: break-all;
  white-space: pre-wrap;
  color: ${p => p.theme.gray300};
`;

const Separator = styled(Value)`
  padding-right: ${space(0.5)};
`;
