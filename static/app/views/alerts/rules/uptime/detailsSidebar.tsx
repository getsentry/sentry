import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {CodeBlock} from '@sentry/scraps/code';
import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SectionHeading} from 'sentry/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import {t, tn} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';
import {DetailsTimelineLegend} from 'sentry/views/alerts/rules/uptime/detailsTimelineLegend';
import {type UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';
import {UptimeDuration} from 'sentry/views/insights/uptime/components/duration';
import {UptimePercent} from 'sentry/views/insights/uptime/components/percent';

interface UptimeDetailsSidebarProps {
  showMissedLegend: boolean;
  uptimeDetector: UptimeDetector;
  summary?: UptimeSummary | null;
}

export function UptimeDetailsSidebar({
  summary,
  uptimeDetector,
  showMissedLegend,
}: UptimeDetailsSidebarProps) {
  const uptimeSub = uptimeDetector.dataSources[0].queryObj;

  return (
    <Fragment>
      <MonitorUrlContainer>
        <SectionHeading>{t('Checked URL')}</SectionHeading>
        <CodeBlock hideCopyButton>{`${uptimeSub.method} ${uptimeSub.url}`}</CodeBlock>
      </MonitorUrlContainer>
      <Grid columns="2fr 1fr 1fr" gap="2xl">
        <UptimeContainer>
          <SectionHeading>{t('Legend')}</SectionHeading>
          <DetailsTimelineLegend showMissedLegend={showMissedLegend} />
        </UptimeContainer>
        <div>
          <SectionHeading>{t('Duration')}</SectionHeading>
          <UptimeContainer>
            {summary === undefined ? (
              <Text size="xl">
                <Placeholder width="60px" height="1lh" />
              </Text>
            ) : summary === null ? (
              '-'
            ) : (
              <UptimeDuration size="xl" summary={summary} />
            )}
          </UptimeContainer>
        </div>
        <div>
          <SectionHeading>{t('Uptime')}</SectionHeading>
          <UptimeContainer>
            {summary === undefined ? (
              <Text size="xl">
                <Placeholder width="60px" height="1lh" />
              </Text>
            ) : summary === null ? (
              '-'
            ) : (
              <UptimePercent
                size="xl"
                summary={summary}
                note={t(
                  'The total calculated uptime of this monitors over the last 90 days.'
                )}
              />
            )}
          </UptimeContainer>
        </div>
      </Grid>
      <SectionHeading>{t('Configuration')}</SectionHeading>
      <KeyValueTable>
        <KeyValueTableRow
          keyName={t('Check Interval')}
          value={t('Every %s', getDuration(uptimeSub.intervalSeconds))}
        />
        <KeyValueTableRow
          keyName={t('Timeout')}
          value={t('After %s', getDuration(uptimeSub.timeoutMs / 1000, 2))}
        />
        <KeyValueTableRow
          keyName={t('Failure tolerance')}
          value={tn(
            '%s failure check',
            '%s failure checks',
            uptimeDetector.config.downtimeThreshold
          )}
        />
        <KeyValueTableRow
          keyName={t('Recovery tolerance')}
          value={tn(
            '%s up check',
            '%s up checks',
            uptimeDetector.config.recoveryThreshold
          )}
        />
        <KeyValueTableRow
          keyName={t('Environment')}
          value={uptimeDetector.config.environment}
        />
        <KeyValueTableRow
          keyName={t('Owner')}
          value={
            uptimeDetector.owner ? (
              <ActorAvatar actor={uptimeDetector.owner} />
            ) : (
              t('Unassigned')
            )
          }
        />
      </KeyValueTable>
    </Fragment>
  );
}

const MonitorUrlContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};

  h4 {
    margin-top: 0;
  }
`;

const UptimeContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;
