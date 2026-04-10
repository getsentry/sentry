import {useCallback} from 'react';
import {css, type Theme} from '@emotion/react';

import monitorsTourAlertsImage from 'sentry-images/spot/monitors-tour-alerts.svg';
import monitorsTourConnectingImage from 'sentry-images/spot/monitors-tour-connecting.svg';
import monitorsTourIntroImage from 'sentry-images/spot/monitors-tour-intro.svg';
import monitorsTourMonitorsImage from 'sentry-images/spot/monitors-tour-monitors.svg';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {FeatureShowcase} from 'sentry/components/featureShowcase';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

const DOCS_URL = 'https://docs.sentry.io/product/new-monitors-and-alerts/';

export function WorkflowEngineFeatureTourButton() {
  const handleClick = useCallback(() => {
    openModal(
      deps => (
        <FeatureShowcase {...deps}>
          <FeatureShowcase.Step>
            <FeatureShowcase.Image
              src={monitorsTourIntroImage}
              alt={t('Introducing Monitors and Alerts')}
            />
            <FeatureShowcase.StepTitle>
              {t('Introducing Monitors & Alerts')}
            </FeatureShowcase.StepTitle>
            <FeatureShowcase.StepContent>
              {t(
                'Monitors detect problems and create issues. These issues trigger Alerts to notify your team.'
              )}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepActions />
          </FeatureShowcase.Step>
          <FeatureShowcase.Step>
            <FeatureShowcase.Image
              src={monitorsTourMonitorsImage}
              alt={t('Monitors detect problems and create issues')}
            />
            <FeatureShowcase.StepTitle>
              {t('Monitors detect problems and create issues')}
            </FeatureShowcase.StepTitle>
            <FeatureShowcase.StepContent>
              {t(
                'Set conditions across your data and when a threshold is breached, Sentry creates an issue.'
              )}
            </FeatureShowcase.StepContent>
            <Stack gap="sm">
              <Text bold>{t('Types of Monitors:')}</Text>
              <ul>
                <li>
                  <Text>
                    <Text bold as="span">
                      {t('Metric')}
                    </Text>
                    {' — '}
                    {t('count, attributes, tags, custom metrics, and more')}
                  </Text>
                </li>
                <li>
                  <Text>
                    <Text bold as="span">
                      {t('Error')}
                    </Text>
                    {' — '}
                    {t('unhandled, recurring, or volume-based')}
                  </Text>
                </li>
                <li>
                  <Text>
                    <Text bold as="span">
                      {t('Uptime')}
                    </Text>
                    {' — '}
                    {t('service availability and reliability')}
                  </Text>
                </li>
                <li>
                  <Text>
                    <Text bold as="span">
                      {t('Mobile Builds')}
                    </Text>
                    {' — '}
                    {t('build size and regressions')}
                  </Text>
                </li>
                <li>
                  <Text>
                    <Text bold as="span">
                      {t('Cron')}
                    </Text>
                    {' — '}
                    {t(
                      'group incoming errors into issues based on your project settings'
                    )}
                  </Text>
                </li>
              </ul>
            </Stack>
            <FeatureShowcase.StepActions />
          </FeatureShowcase.Step>
          <FeatureShowcase.Step>
            <FeatureShowcase.Image
              src={monitorsTourAlertsImage}
              alt={t('Alerts notify your team')}
            />
            <FeatureShowcase.StepTitle>
              {t('Alerts notify your team')}
            </FeatureShowcase.StepTitle>
            <FeatureShowcase.StepContent>
              {t(
                'Alerts notify your team. Define who gets paged, when, and how — via Slack, email, PagerDuty, and more.'
              )}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepContent>
              {t(
                'Scale and connect to many monitors, projects, and issue types. Configure your routing so the right people get notified when it matters.'
              )}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepActions />
          </FeatureShowcase.Step>
          <FeatureShowcase.Step>
            <FeatureShowcase.Image
              src={monitorsTourConnectingImage}
              alt={t('Connecting Alerts and Monitors')}
            />
            <FeatureShowcase.StepTitle>
              {t('Connecting Alerts & Monitors')}
            </FeatureShowcase.StepTitle>
            <FeatureShowcase.StepContent>
              {t(
                'When creating a Monitor you have the option of setting up a new Alert or connecting to an existing Alert at the same time.'
              )}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepContent>
              {t(
                'When creating or editing Alerts you can connect to existing routing without ever touching your Monitor logic.'
              )}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepContent>
              {tct('For more information, [link:read the docs].', {
                link: <ExternalLink href={DOCS_URL} />,
              })}
            </FeatureShowcase.StepContent>
            <FeatureShowcase.StepActions />
          </FeatureShowcase.Step>
        </FeatureShowcase>
      ),
      {
        modalCss: (theme: Theme) => css`
          width: 490px;

          [role='document'] {
            padding: ${theme.space['2xl']};
            padding-top: ${theme.space.lg};
          }
        `,
      }
    );
  }, []);

  return (
    <Button
      size="sm"
      icon={<IconInfo />}
      onClick={handleClick}
      aria-label={t('Feature tour')}
    />
  );
}
