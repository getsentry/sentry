import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {CheckIndicator} from 'sentry/views/detectors/components/uptime/checkIndicator';
import {CheckStatus} from 'sentry/views/detectors/components/uptime/types';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';

export function DetailsTimelineLegend({showMissedLegend}: {showMissedLegend: boolean}) {
  return (
    <CheckLegend>
      <Grid as="li" align="center" column="1 / -1" columns="subgrid">
        <CheckIndicator status={CheckStatus.SUCCESS} />
        <Flex align="center" gap="md">
          {statusToText[CheckStatus.SUCCESS]}
          <InfoTip
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
        </Flex>
      </Grid>
      <Grid as="li" align="center" column="1 / -1" columns="subgrid">
        <CheckIndicator status={CheckStatus.FAILURE} />
        <Flex align="center" gap="md">
          {statusToText[CheckStatus.FAILURE]}
          <InfoTip
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
        </Flex>
      </Grid>
      <Grid as="li" align="center" column="1 / -1" columns="subgrid">
        <CheckIndicator status={CheckStatus.FAILURE_INCIDENT} />
        <Flex align="center" gap="md">
          {statusToText[CheckStatus.FAILURE_INCIDENT]}
          <InfoTip
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
        </Flex>
      </Grid>
      {showMissedLegend && (
        <Grid as="li" align="center" column="1 / -1" columns="subgrid">
          <CheckIndicator status={CheckStatus.MISSED_WINDOW} />
          <Flex align="center" gap="md">
            {statusToText[CheckStatus.MISSED_WINDOW]}
            <InfoTip
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
          </Flex>
        </Grid>
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
