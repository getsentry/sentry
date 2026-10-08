import {LinkButton} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';

import {IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';

export function OrgStatsProfilingBanner() {
  const location = useLocation();
  return (
    <Grid
      columns={{zero: '1fr', '3xl': 'repeat(2, 1fr)', '4xl': 'repeat(3, 1fr)'}}
      border="primary"
      radius="md"
      marginBottom="xl"
    >
      <Container
        column={{zero: 'span 1', '3xl': 'span 2', '4xl': 'span 1'}}
        padding="xl"
        background="secondary"
        borderBottom={{zero: 'primary', '4xl': 'none'}}
      >
        <h6>{t('Profiling has a new billing model!')}</h6>
        <span>
          {t(`
          We've split Profiling into two products targeted at different use cases –
          Continuous Profiling for the backend and UI Profiling for the frontend. These
          products are billed separately.
          `)}
        </span>
      </Container>
      <Container
        padding="xl"
        borderBottom={{zero: 'primary', '3xl': 'none'}}
        borderRight={{zero: 'none', '3xl': 'primary'}}
        borderLeft={{zero: 'none', '4xl': 'primary'}}
      >
        <h6>{t('UI Profile Hours')}</h6>
        <span>
          {t(`
          Ensure great UX on browser and mobile apps by fixing issues that cause long load
          times and unresponsive interactions.
          `)}
        </span>
        <Container marginTop="md">
          <LinkButton
            size="sm"
            icon={<IconShow />}
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDurationUI'},
            }}
          >
            {t('Go to UI Profile Hours')}
          </LinkButton>
        </Container>
      </Container>
      <Container padding="xl">
        <h6>{t('Continuous Profile Hours')}</h6>
        <span>
          {t(`
          Find performance bottlenecks in backend services that cause high request latency
          and excessive infrastructure costs.
          `)}
        </span>
        <Container marginTop="md">
          <LinkButton
            size="sm"
            icon={<IconShow />}
            to={{
              ...location,
              query: {...location.query, dataCategory: 'profileDuration'},
            }}
          >
            {t('Go to Continuous Profile Hours')}
          </LinkButton>
        </Container>
      </Container>
    </Grid>
  );
}
