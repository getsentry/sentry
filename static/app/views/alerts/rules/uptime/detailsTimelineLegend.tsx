import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {tct} from 'sentry/locale';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';

export function DetailsTimelineLegend({showMissedLegend}: {showMissedLegend: boolean}) {
  return (
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
  );
}

const CheckLegend = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  padding: 0;
  gap: ${p => p.theme.space.md};
  margin-bottom: 0;
`;

const CheckLegendItem = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  grid-column: 1 / -1;
`;

const LegendText = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;
