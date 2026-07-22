import styled from '@emotion/styled';

import campingImg from 'sentry-images/spot/onboarding-preview.svg';

import {Flex, Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

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
      className="empty-state"
      direction={{zero: 'column', sm: 'row'}}
      align={{zero: 'center', sm: 'stretch'}}
      gap={{zero: '0', sm: 'xl'}}
      justify="center"
      padding="2xl"
      minHeight="260px"
      style={{
        fontSize: '16px',
        borderRadius: '0 0 3px 3px',
        textAlign: 'center',
      }}
    >
      <img src={campingImg} alt="Camping spot illustration" height={200} />
      <Container maxWidth="480px" alignSelf="center">
        <h3>{t('No issues match your search')}</h3>
        <div>{t('If this is unexpected, check out these tips:')}</div>
        <Tips>
          <li>{t('Double check your project, environment, and date filters')}</li>
          <li>
            {tct('Make sure your search has the right syntax. [link]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/concepts/search/">
                  {t('Learn more')}
                </ExternalLink>
              ),
            })}
          </li>
          <li>
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
          </li>
          {(onBreachedMetricsView || onWarningsView) && (
            <li>
              {tct('Make sure [link] is set up in your project.', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=%2Ftracing%2F">
                    {t('tracing')}
                  </ExternalLink>
                ),
              })}
            </li>
          )}
          {onErrorsAndOutagesView && (
            <li>
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
            </li>
          )}
        </Tips>
      </Container>
    </Flex>
  );
}

const Tips = styled('ul')`
  text-align: left;
`;
