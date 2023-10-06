import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container} from 'sentry/utils/discover/styles';
import {getDuration} from 'sentry/utils/formatters';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {generateProfileSummaryRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

interface EventAffectedTransactionsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function EventAffectedTransactions({
  event,
  project,
}: EventAffectedTransactionsProps) {
  const evidenceData = event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;

  const isValid = defined(fingerprint) && defined(breakpoint);

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint]);

  if (!isValid) {
    return null;
  }

  return (
    <EventAffectedTransactionsInner
      breakpoint={breakpoint}
      fingerprint={fingerprint}
      project={project}
    />
  );
}

const DAY = 24 * 60 * 60 * 1000;

interface EventAffectedTransactionsInnerProps {
  breakpoint: number;
  fingerprint: number;
  project: Project;
}

function EventAffectedTransactionsInner({
  breakpoint,
  fingerprint,
  project,
}: EventAffectedTransactionsInnerProps) {
  const organization = useOrganization();

  // Make sure to memo this. Otherwise, each re-render will have
  // a different min/max date time, causing the query to refetch.
  const maxDateTime = useMemo(() => Date.now(), []);
  const minDateTime = maxDateTime - 90 * DAY;

  const breakpointTime = breakpoint * 1000;

  // Try to create a query for a 14 day period around the breakpoint.
  const beforeTime = breakpointTime - 7 * DAY;
  const beforeDateTime =
    beforeTime >= minDateTime ? new Date(beforeTime) : new Date(minDateTime);
  const afterTime = breakpointTime + 7 * DAY;
  const afterDateTime =
    afterTime <= maxDateTime ? new Date(afterTime) : new Date(maxDateTime);

  const percentileBefore = `percentile_before(function.duration, 0.95, ${breakpoint})`;
  const percentileAfter = `percentile_after(function.duration, 0.95, ${breakpoint})`;
  const percentileDelta = `percentile_delta(function.duration, 0.95, ${breakpoint})`;

  const transactionsDeltaQuery = useProfileFunctions({
    datetime: {
      start: beforeDateTime,
      end: afterDateTime,
      utc: true,
      period: null,
    },
    fields: ['transaction', percentileBefore, percentileAfter, percentileDelta],
    sort: {
      key: percentileDelta,
      order: 'desc',
    },
    query: `fingerprint:${fingerprint} ${percentileDelta}:>0`,
    projects: [project.id],
    limit: 5,
    referrer: 'api.profiling.functions.regression.transactions',
  });

  return (
    <EventDataSection type="transactions-impacted" title={t('Transactions Impacted')}>
      <ListContainer>
        {(transactionsDeltaQuery.data?.data ?? []).map(transaction => {
          const summaryTarget = generateProfileSummaryRouteWithQuery({
            orgSlug: organization.slug,
            projectSlug: project.slug,
            transaction: transaction.transaction as string,
          });
          return (
            <Fragment key={transaction.transaction as string}>
              <Container>
                <Link to={summaryTarget}>{transaction.transaction}</Link>
              </Container>
              <Container>
                <Tooltip
                  title={tct(
                    'The function duration in this transaction increased from [before] to [after]',
                    {
                      before: getDuration(
                        (transaction[percentileBefore] as number) / 1_000_000_000,
                        2,
                        true
                      ),
                      after: getDuration(
                        (transaction[percentileAfter] as number) / 1_000_000_000,
                        2,
                        true
                      ),
                    }
                  )}
                  position="top"
                >
                  <DurationChange>
                    <PerformanceDuration
                      nanoseconds={transaction[percentileBefore] as number}
                      abbreviation
                    />
                    <IconArrow direction="right" size="xs" />
                    <PerformanceDuration
                      nanoseconds={transaction[percentileAfter] as number}
                      abbreviation
                    />
                  </DurationChange>
                </Tooltip>
              </Container>
            </Fragment>
          );
        })}
      </ListContainer>
    </EventDataSection>
  );
}

const ListContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;

const DurationChange = styled('span')`
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
