import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import invert from 'lodash/invert';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DataSection} from 'sentry/components/events/styles';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import countryCodesMap from 'sentry/data/countryCodesMap';
import {t, tct} from 'sentry/locale';
import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DisplayModes,
  transactionSummaryRouteWithQuery,
} from 'sentry/views/performance/transactionSummary/utils';

interface GeoDiff {
  duration_after: number;
  duration_before: number;
  duration_delta: number;
  ['geo.country_code']: string;
}

interface UseFetchAdvancedAnalysisProps {
  breakpoint: string;
  end: string;
  projectId: string;
  start: string;
  transaction: string;
}

function useFetchGeoAnalysis({
  transaction,
  start,
  end,
  breakpoint,
  projectId,
}: UseFetchAdvancedAnalysisProps) {
  const organization = useOrganization();
  return useApiQuery<GeoDiff[]>(
    [
      `/organizations/${organization.slug}/events-root-cause-analysis/`,
      {
        query: {
          transaction,
          project: projectId,
          start,
          end,
          breakpoint,
          per_page: 5,
          type: 'geo',
        },
      },
    ],
    {
      staleTime: 60000,
      retry: false,
    }
  );
}

function calculatePercentChange(before: number, delta: number) {
  return (delta / before) * 100;
}

function GeoLocationDiff({event, projectId}: {event: Event; projectId: string}) {
  const organization = useOrganization();
  const countryCodesToCountry = useMemo(() => invert(countryCodesMap), []);

  const {transaction, breakpoint} = event?.occurrence?.evidenceData ?? {};
  const breakpointTimestamp = new Date(breakpoint * 1000).toISOString();

  const {start, end} = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 7,
  });
  const {data, isLoading, isError} = useFetchGeoAnalysis({
    transaction,
    start: (start as Date).toISOString(),
    end: (end as Date).toISOString(),
    breakpoint: breakpointTimestamp,
    projectId,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  let content;
  if (isError) {
    content = (
      <EmptyStateWarning>
        <p>{t('Oops! Something went wrong when analyzing regressions by countries')}</p>
      </EmptyStateWarning>
    );
  } else if (!defined(data) || data.length === 0) {
    content = (
      <EmptyStateWarning>
        <p>
          {t('Unable to find significant differences in country transaction durations')}
        </p>
      </EmptyStateWarning>
    );
  } else {
    content = (
      <Fragment>
        <strong>{t('Countries Impacted:')}</strong>
        <div style={{marginBottom: '8px'}}>
          {t(
            'An increase in the transaction duration has been detected for the following countries. The results are sorted by their overall effect on the duration, based off of the change in duration and the current TPM.'
          )}
        </div>
        <ul>
          {data.map(row => {
            const countryCode = row['geo.country_code'];
            const percentChange = calculatePercentChange(
              row.duration_before,
              row.duration_delta
            );
            const transactionSummaryLink = transactionSummaryRouteWithQuery({
              orgSlug: organization.slug,
              transaction,
              query: {
                start: (start as Date).toISOString(),
                end: (end as Date).toISOString(),
                query: `geo.country_code:${countryCode}`,
              },
              projectID: projectId,
              display: DisplayModes.DURATION,
              // Only show p95 series to align with issue context
              unselectedSeries: ['avg()', 'p100()', 'p99()', 'p75()', 'p50()'],
            });

            return (
              <li key={countryCode}>
                <GeoAnalysisEntry>
                  <strong style={{justifySelf: 'start'}}>{countryCode}</strong>{' '}
                  <span style={{justifySelf: 'start'}}>
                    {countryCodesToCountry[countryCode]}
                  </span>
                  <div style={{justifySelf: 'end'}}>
                    <Tooltip
                      title={
                        <div data-test-id="geo-duration-change-tooltip-content">
                          {tct('From [previousDuration] to [currentDuration]', {
                            previousDuration: (
                              <PerformanceDuration
                                milliseconds={row.duration_before}
                                abbreviation
                              />
                            ),
                            currentDuration: (
                              <PerformanceDuration
                                milliseconds={row.duration_after}
                                abbreviation
                              />
                            ),
                          })}
                        </div>
                      }
                      showUnderline
                    >
                      <Link to={transactionSummaryLink}>
                        {percentChange > 0 && '+'}
                        {percentChange.toFixed(2)}%
                      </Link>
                    </Tooltip>
                  </div>
                </GeoAnalysisEntry>
              </li>
            );
          })}
        </ul>
      </Fragment>
    );
  }

  return <DataSection>{content}</DataSection>;
}

export default GeoLocationDiff;

const GeoAnalysisEntry = styled('div')`
  display: grid;
  grid-template-columns: min-content auto min-content;
  gap: 8px;
`;
