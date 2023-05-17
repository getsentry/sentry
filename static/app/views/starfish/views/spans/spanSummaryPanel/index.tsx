import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import TimeSince from 'sentry/components/timeSince';
import Detail from 'sentry/views/starfish/components/detailPanel';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useSpanMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetrics';

type Props = {
  onClose: () => void;
  span?: Span;
};

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function SpanSummaryPanel({span, onClose}: Props) {
  const {data: spanMetrics} = useSpanMetrics(span);

  return (
    <Detail detailKey={span?.group_id} onClose={onClose}>
      <h2>{t('Span Summary')}</h2>
      <SubHeader>{t('Description')}</SubHeader>
      <pre>{span?.description}</pre>

      <FlexRowContainer>
        <Block title={t('First Seen')}>
          <TimeSince date={spanMetrics?.first_seen} />
        </Block>

        <Block title={t('Last Seen')}>
          <TimeSince date={spanMetrics?.last_seen} />
        </Block>

        <Block title={t('Total Time')}>
          <Duration
            seconds={spanMetrics?.total_time / 1000}
            fixedDigits={2}
            abbreviation
          />
        </Block>
      </FlexRowContainer>
    </Detail>
  );
}

type BlockProps = {
  children: React.ReactNode;
  title: React.ReactNode;
};

function Block({title, children}: BlockProps) {
  return (
    <FlexRowItem>
      <SubHeader>{title}</SubHeader>
      <SubSubHeader>{children}</SubSubHeader>
    </FlexRowItem>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SubSubHeader = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const FlexRowContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
  padding-bottom: ${space(2)};
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
