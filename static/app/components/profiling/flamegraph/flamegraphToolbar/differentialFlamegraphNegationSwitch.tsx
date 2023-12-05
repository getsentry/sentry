import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';

interface DifferentialFlamegraphNegationSwitchProps {
  onSourceChange: (source: 'before' | 'after') => void;
  source: 'before' | 'after';
}
export function DifferentialFlamegraphNegationSwitch(
  props: DifferentialFlamegraphNegationSwitchProps
) {
  return (
    <DifferentialFlamegraphNegationSwitchContainer>
      <SegmentedControl
        aria-label={t('View')}
        size="xs"
        value={props.source}
        onChange={props.onSourceChange}
      >
        <SegmentedControl.Item key="before">{t('Before → After')}</SegmentedControl.Item>
        <SegmentedControl.Item key="after">{t('After → Before')}</SegmentedControl.Item>
      </SegmentedControl>
    </DifferentialFlamegraphNegationSwitchContainer>
  );
}

const DifferentialFlamegraphNegationSwitchContainer = styled('div')`
  /* after this size, the text is quickly truncated */
  min-width: 210px;
`;
