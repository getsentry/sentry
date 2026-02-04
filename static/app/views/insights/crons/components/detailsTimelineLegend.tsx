import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct, tn} from 'sentry/locale';
import {
  DEFAULT_CHECKIN_MARGIN,
  DEFAULT_MAX_RUNTIME,
} from 'sentry/views/insights/crons/components/monitorForm';
import {MonitorIndicator} from 'sentry/views/insights/crons/components/monitorIndicator';
import {CheckInStatus} from 'sentry/views/insights/crons/types';

interface Props {
  checkInMargin: number | null;
  maxRuntime: number | null;
  /**
   * Include the UNKNOWN status in the check-in type legend
   */
  showUnknownLegend?: boolean;
}

export function DetailsTimelineLegend({
  checkInMargin,
  maxRuntime,
  showUnknownLegend,
}: Props) {
  return (
    <CheckInLegend>
      <CheckInLegendItem>
        <MonitorIndicator status={CheckInStatus.MISSED} size={12} />
        <Text>
          {tn(
            'Check-in missed after %s min',
            'Check-in missed after %s mins',
            checkInMargin ?? DEFAULT_CHECKIN_MARGIN
          )}
        </Text>
      </CheckInLegendItem>
      <CheckInLegendItem>
        <MonitorIndicator status={CheckInStatus.ERROR} size={12} />
        <Text>{t('Check-in reported as failed')}</Text>
      </CheckInLegendItem>
      <CheckInLegendItem>
        <MonitorIndicator status={CheckInStatus.TIMEOUT} size={12} />
        <Text>
          {tn(
            'Check-in timed out after %s min',
            'Check-in timed out after %s mins',
            maxRuntime ?? DEFAULT_MAX_RUNTIME
          )}
        </Text>
      </CheckInLegendItem>
      {showUnknownLegend && (
        <CheckInLegendItem>
          <MonitorIndicator status={CheckInStatus.UNKNOWN} size={12} />
          <UnknownText>
            {t('Unknown Status')}
            <QuestionTooltip
              size="sm"
              isHoverable
              title={tct(
                'Sentry was unable to determine the check-in status. [link:Learn More].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/crons/monitor-details/#check-in-statuses" />
                  ),
                }
              )}
            />
          </UnknownText>
        </CheckInLegendItem>
      )}
    </CheckInLegend>
  );
}

const CheckInLegend = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  margin-bottom: 0;
  padding: 0;
  gap: ${p => p.theme.space.md};
`;

const CheckInLegendItem = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  grid-column: 1 / -1;
`;

const UnknownText = styled(Text)`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;
