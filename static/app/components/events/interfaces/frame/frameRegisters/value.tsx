import {useState} from 'react';
import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Meta} from 'sentry/types';

const REGISTER_VIEWS = [t('Hexadecimal'), t('Numeric')];

type Props = {
  value: string | number;
  meta?: Meta;
};

type State = {
  view: number;
};

export function FrameRegisterValue({meta, value}: Props) {
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
          return `0x${parsed.toString(16).padStart(16, '0')}`;
      }
    } catch {
      return value;
    }
  }

  return (
    <InlinePre>
      <AnnotatedText value={formatValue()} meta={meta} />
      <StyledTooltip
        title={REGISTER_VIEWS[state.view]}
        containerDisplayMode="inline-flex"
      >
        <Toggle
          onClick={() => {
            setState({view: (state.view + 1) % REGISTER_VIEWS.length});
          }}
          size="xs"
          aria-label={t('Toggle register value format')}
        />
      </StyledTooltip>
    </InlinePre>
  );
}

const StyledTooltip = styled(Tooltip)`
  align-items: center;
`;

const InlinePre = styled('pre')`
  margin: 0;
  padding: ${space(1)};
  display: inline-grid;
  line-height: 1rem;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  text-align: left;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Toggle = styled(IconSliders)`
  opacity: 0.33;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;
