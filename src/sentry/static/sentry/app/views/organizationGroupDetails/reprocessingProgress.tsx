import React from 'react';
import styled from '@emotion/styled';

import ProgressBar from 'app/components/progressBar';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {percent} from 'app/utils';

type Props = {
  totalEvents: number;
  pendingEvents: number;
};

function ReprocessingProgress({totalEvents, pendingEvents}: Props) {
  const remainingEventsToReprocess = totalEvents - pendingEvents;
  const remainingEventsToReprocessPercent = percent(
    remainingEventsToReprocess,
    totalEvents
  );

  return (
    <Wrapper>
      <Inner>
        <Header>
          <Title>{t('Reprocessing\u2026')}</Title>
          {t(
            'Once the events in this issue have been reprocessed, you’ll be able to make changes and view any new issues that may have been created.'
          )}
        </Header>
        <Content>
          <ProgressBar value={remainingEventsToReprocessPercent} variant="large" />
          {tct('[remainingEventsToReprocess]/[totalEvents] [event] reprocessed', {
            remainingEventsToReprocess,
            totalEvents,
            event: tn('event', 'events', totalEvents),
          })}
        </Content>
      </Inner>
    </Wrapper>
  );
}
export default ReprocessingProgress;

const Wrapper = styled('div')`
  margin: ${space(4)} 40px;
  flex: 1;
  text-align: center;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    margin: 40px;
  }
`;

const Content = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: grid;
  grid-gap: ${space(1.5)};
  justify-items: center;
  max-width: 402px;
  width: 100%;
`;

const Inner = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
  justify-items: center;
`;

const Header = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  color: ${p => p.theme.textColor};
  max-width: 557px;
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 600;
  margin-bottom: 0;
`;
