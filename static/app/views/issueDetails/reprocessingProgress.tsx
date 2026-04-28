import styled from '@emotion/styled';

import {ProgressBar} from 'sentry/components/progressBar';
import {t, tct, tn} from 'sentry/locale';
import {percent} from 'sentry/utils';

type Props = {
  pendingEvents: number;
  totalEvents: number;
};

export function ReprocessingProgress({totalEvents, pendingEvents}: Props) {
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

const Wrapper = styled('div')`
  margin: ${p => p.theme.space['3xl']} 40px;
  flex: 1;
  text-align: center;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    margin: 40px;
  }
`;

const Content = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  display: grid;
  gap: ${p => p.theme.space.lg};
  justify-items: center;
  max-width: 402px;
  width: 100%;
`;

const Inner = styled('div')`
  display: grid;
  gap: ${p => p.theme.space['2xl']};
  justify-items: center;
`;

const Header = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  color: ${p => p.theme.tokens.content.primary};
  max-width: 557px;
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: 0;
`;
