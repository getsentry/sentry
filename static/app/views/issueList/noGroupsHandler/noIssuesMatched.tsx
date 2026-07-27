import campingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export function NoIssuesMatched() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const location = useLocation();
  const onBreachedMetricsView = location.pathname.endsWith('/issues/breached-metrics/');
  const onWarningsView = location.pathname.endsWith('/issues/warnings/');
  const onErrorsAndOutagesView = location.pathname.endsWith('/issues/errors-outages/');

  return (
    <Flex
      data-test-id="empty-state"
      direction={{zero: 'column', xl: 'row'}}
      align={{zero: 'center', xl: 'stretch'}}
      gap="3xl"
      justify="center"
      padding="2xl"
      minHeight="260px"
    >
      <img src={campingImg} alt="Camping spot illustration" height={200} />
      <Stack maxWidth="480px" alignSelf="center">
        <Container alignSelf={{zero: 'center', xl: 'auto'}}>
          {containerProps => (
            <Heading as="h3" size="2xl" {...containerProps}>
              {t('No issues match your search')}
            </Heading>
          )}
        </Container>
        <Stack gap="md">
          <Container alignSelf={{zero: 'center', xl: 'auto'}}>
            {containerProps => (
              <Text size="lg" {...containerProps}>
                {t('If this is unexpected, check out these tips:')}
              </Text>
            )}
          </Container>

          <ul>
            <li>
              <Text size="lg">
                {t('Double check your project, environment, and date filters')}
              </Text>
            </li>
            <li>
              <Text size="lg">
                {tct('Make sure your search has the right syntax. [link]', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/concepts/search/">
                      {t('Learn more')}
                    </ExternalLink>
                  ),
                })}
              </Text>
            </li>
            <li>
              <Text size="lg">
                {tct(
                  "Check your [filterSettings: inbound data filters] to make sure the events aren't being filtered out",
                  {
                    filterSettings: (
                      <a
                        href="#"
                        onClick={event => {
                          event.preventDefault();
                          const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
                          navigateTo(url, navigate, location);
                        }}
                      />
                    ),
                  }
                )}
              </Text>
            </li>
            {(onBreachedMetricsView || onWarningsView) && (
              <li>
                <Text size="lg">
                  {tct('Make sure [link] is set up in your project.', {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Ftracing%2F">
                        {t('tracing')}
                      </ExternalLink>
                    ),
                  })}
                </Text>
              </li>
            )}
            {onErrorsAndOutagesView && (
              <li>
                <Text size="lg">
                  {tct(
                    'Make sure [uptimeLink] and [cronsLink] monitoring is set up in your project.',
                    {
                      uptimeLink: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/">
                          {t('uptime')}
                        </ExternalLink>
                      ),
                      cronsLink: (
                        <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Fcrons%2F">
                          {t('cron')}
                        </ExternalLink>
                      ),
                    }
                  )}
                </Text>
              </li>
            )}
          </ul>
        </Stack>
      </Stack>
    </Flex>
  );
}
