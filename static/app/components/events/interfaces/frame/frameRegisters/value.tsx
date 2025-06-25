import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Meta} from 'sentry/types/group';

type Props = {
  value: string | number;
  meta?: Meta;
};

export function FrameRegisterValue({meta, value}: Props) {
  const [isHexadecimal, setIsHexadecimal] = useState(true);

  function formatValue() {
    try {
      const parsed = typeof value === 'string' ? parseInt(value, 16) : value;
      if (isNaN(parsed)) {
        return value;
      }

      return isHexadecimal ? `0x${parsed.toString(16).padStart(16, '0')}` : `${parsed}`;
    } catch {
      return value;
    }
  }

  const toggleFormat = () => {
    setIsHexadecimal(!isHexadecimal);
  };

  const formatLabel = isHexadecimal ? t('Hexadecimal') : t('Numeric');

  return (
    <InlinePre>
      <AnnotatedText value={formatValue()} meta={meta} />
      <div>
        <ToggleButton
          size="zero"
          borderless
          icon={<IconSliders size="xs" />}
          onClick={toggleFormat}
          title={formatLabel}
          aria-label={t('Toggle register value format')}
        />
      </div>
    </InlinePre>
  );
}

const InlinePre = styled('pre')`
  margin: 0;
  padding: ${space(1)};
  display: inline-grid;
  line-height: 1rem;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  text-align: left;
  font-size: ${p => p.theme.fontSize.sm};
`;

const ToggleButton = styled(Button)`
  opacity: 0.33;

  &:hover {
    opacity: 1;
  }
`;
