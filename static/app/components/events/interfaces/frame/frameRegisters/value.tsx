import {useState} from 'react';
import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import Tooltip from 'sentry/components/tooltip';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Meta} from 'sentry/types';

const REGISTER_VIEWS = [t('Hexadecimal'), t('Numeric')];

type Props = {
  value: string | number;
  meta?: Meta;
};

type State = {
  view: number;
};

function Value({meta, value}: Props) {
  const [state, setState] = useState<State>({view: 0});

  function formatValue() {
    try {
      const parsed = typeof value === 'string' ? parseInt(value, 16) : value;
      if (isNaN(parsed)) {
        return value;
      }

      switch (state.view) {
        case 1:
          return `${parsed}`;
        case 0:
        default:
          return `0x${('0000000000000000' + parsed.toString(16)).substr(-16)}`;
      }
    } catch {
      return value;
    }
  }

  return (
    <InlinePre data-test-id="frame-registers-value">
      <FixedWidth>
        <AnnotatedText value={formatValue()} meta={meta} />
      </FixedWidth>
      <Tooltip title={REGISTER_VIEWS[state.view]}>
        <Toggle
          onClick={() => {
            setState({view: (state.view + 1) % REGISTER_VIEWS.length});
          }}
          size="xs"
        />
      </Tooltip>
    </InlinePre>
  );
}

export default Value;

const InlinePre = styled('pre')`
  display: inline;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(0.5)};
`;

const FixedWidth = styled('span')`
  width: 11em;
  display: inline-block;
  text-align: right;
  margin-right: 1ex;
`;

const Toggle = styled(IconSliders)`
  opacity: 0.33;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;
