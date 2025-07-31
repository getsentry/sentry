import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {
  CheckStatus,
  type UptimeRule,
  type UptimeSummary,
} from 'sentry/views/alerts/rules/uptime/types';
import {UptimePercent} from 'sentry/views/insights/uptime/components/percent';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';

interface UptimeDetailsSidebarProps {
  showMissedLegend: boolean;
  uptimeRule: UptimeRule;
  summary?: UptimeSummary;
}

export function UptimeDetailsSidebar({
  summary,
  uptimeRule,
  showMissedLegend,
}: UptimeDetailsSidebarProps) {
  return (
    <Fragment>
      <MonitorUrlContainer>
        <SectionHeading>{t('Checked URL')}</SectionHeading>
        <CodeSnippet
          hideCopyButton
        >{`${uptimeRule.method} ${uptimeRule.url}`}</CodeSnippet>
      </MonitorUrlContainer>
      <Grid columns="1fr 1fr" gap="md">
        <div>
          <SectionHeading>{t('Legend')}</SectionHeading>
          <CheckLegend>
            <CheckLegendItem>
              <CheckIndicator status={CheckStatus.SUCCESS} />
              <LegendText>
                {statusToText[CheckStatus.SUCCESS]}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={tct(
                    'A check status is considered uptime when it meets the uptime check criteria. [link:Learn more].',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-criteria" />
                      ),
                    }
                  )}
                />
              </LegendText>
            </CheckLegendItem>
            <CheckLegendItem>
              <CheckIndicator status={CheckStatus.FAILURE} />
              <LegendText>
                {statusToText[CheckStatus.FAILURE]}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={tct(
                    'A check status is considered as a failure when a check fails but hasn’t recorded three consecutive failures needed for Downtime. [link:Learn more].',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                      ),
                    }
                  )}
                />
              </LegendText>
            </CheckLegendItem>
            <CheckLegendItem>
              <CheckIndicator status={CheckStatus.FAILURE_INCIDENT} />
              <LegendText>
                {statusToText[CheckStatus.FAILURE_INCIDENT]}
                <QuestionTooltip
                  isHoverable
                  size="sm"
                  title={tct(
                    'A check status is considered downtime when it fails 3 consecutive times, meeting the Downtime threshold. [link:Learn more].',
                    {
                      link: (
                        <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                      ),
                    }
                  )}
                />
              </LegendText>
            </CheckLegendItem>
            {showMissedLegend && (
              <CheckLegendItem>
                <CheckIndicator status={CheckStatus.MISSED_WINDOW} />
                <LegendText>
                  {statusToText[CheckStatus.MISSED_WINDOW]}
                  <QuestionTooltip
                    isHoverable
                    size="sm"
                    title={tct(
                      'A check status is unknown when Sentry is unable to execute an uptime check at the scheduled time. [link:Learn more].',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/#uptime-check-failures" />
                        ),
                      }
                    )}
                  />
                </LegendText>
              </CheckLegendItem>
            )}
          </CheckLegend>
        </div>
        <div>
          <SectionHeading>{t('Monitor Uptime')}</SectionHeading>
          <UptimeContainer>
            {summary ? (
              <UptimePercent
                size="xl"
                summary={summary}
                note={t(
                  'The total calculated uptime of this monitors over the last 90 days.'
                )}
              />
            ) : (
              <Text size="xl">
                <Placeholder width="60px" height="1lh" />
              </Text>
            )}
          </UptimeContainer>
        </div>
      </Grid>
      <SectionHeading>{t('Configuration')}</SectionHeading>
      <KeyValueTable>
        <KeyValueTableRow
          keyName={t('Check Interval')}
          value={t('Every %s', getDuration(uptimeRule.intervalSeconds))}
        />
        <KeyValueTableRow
          keyName={t('Timeout')}
          value={t('After %s', getDuration(uptimeRule.timeoutMs / 1000, 2))}
        />
        <KeyValueTableRow keyName={t('Environment')} value={uptimeRule.environment} />
        <KeyValueTableRow
          keyName={t('Owner')}
          value={
            uptimeRule.owner ? <ActorAvatar actor={uptimeRule.owner} /> : t('Unassigned')
          }
        />
      </KeyValueTable>
    </Fragment>
  );
}

const CheckLegend = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(2)};
  padding: 0;
  gap: ${space(1)};
`;

const CheckLegendItem = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  grid-column: 1 / -1;
`;

const LegendText = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const MonitorUrlContainer = styled('div')`
  margin-bottom: ${space(2)};

  h4 {
    margin-top: 0;
  }
`;

const UptimeContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
