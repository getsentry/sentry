import {Container, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

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
    <Container flex={1} margin="3xl">
      <Grid
        gap="2xl"
        justifyItems="center"
        margin="0 xs"
        padding={{zero: '0', xl: 'xs 0'}}
      >
        <Grid gap="md" maxWidth="557px">
          <Heading as="h3" size="xl" align="center">
            {t('Reprocessing\u2026')}
          </Heading>
          <Text as="div" align="center" variant="primary">
            {t(
              'Once the events in this issue have been reprocessed, you’ll be able to make changes and view any new issues that may have been created.'
            )}
          </Text>
        </Grid>
        <Grid gap="lg" justifyItems="center" maxWidth="402px" width="100%">
          <ProgressBar value={remainingEventsToReprocessPercent} variant="large" />
          <Text as="div" size="md" align="center" variant="muted">
            {tct('[remainingEventsToReprocess]/[totalEvents] [event] reprocessed', {
              remainingEventsToReprocess,
              totalEvents,
              event: tn('event', 'events', totalEvents),
            })}
          </Text>
        </Grid>
      </Grid>
    </Container>
  );
}
