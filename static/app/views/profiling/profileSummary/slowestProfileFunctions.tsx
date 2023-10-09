import {useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const SLOWEST_FUNCTIONS_LIMIT = 15;
const SLOWEST_FUNCTIONS_CURSOR = 'functionsCursor';

const functionsFields = [
  'package',
  'function',
  'count()',
  'p75()',
  'sum()',
  'examples()',
] as const;

type FunctionsField = (typeof functionsFields)[number];
interface SlowestProfileFunctionsProps {
  transaction: string;
}

export function SlowestProfileFunctions(props: SlowestProfileFunctionsProps) {
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );
  const location = useLocation();
  const functionsCursor = useMemo(
    () => decodeScalar(location.query[SLOWEST_FUNCTIONS_CURSOR]),
    [location.query]
  );
  const functionsSort = useMemo(
    () =>
      formatSort<FunctionsField>(
        decodeScalar(location.query.functionsSort),
        functionsFields,
        {
          key: 'sum()',
          order: 'desc',
        }
      ),
    [location.query.functionsSort]
  );

  const handleFunctionsCursor = useCallback((cursor, pathname, query) => {
    browserHistory.push({
      pathname,
      query: {...query, [SLOWEST_FUNCTIONS_CURSOR]: cursor},
    });
  }, []);

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [props.transaction]);
    if (functionType === 'application') {
      conditions.setFilterValues('is_application', ['1']);
    } else if (functionType === 'system') {
      conditions.setFilterValues('is_application', ['0']);
    }
    return conditions.formatString();
  }, [functionType, props.transaction]);

  const functionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: 'api.profiling.profile-summary-functions-table',
    sort: functionsSort,
    query,
    limit: SLOWEST_FUNCTIONS_LIMIT,
    cursor: functionsCursor,
  });

  useEffect(() => {
    if (
      functionsQuery.isLoading ||
      functionsQuery.isError ||
      functionsQuery.data?.data?.length > 0
    ) {
      return;
    }
    Sentry.captureMessage('No regressed functions detected for flamegraph');
  }, [functionsQuery.data, functionsQuery.isLoading, functionsQuery.isError]);

  const onChangeFunctionType = useCallback(v => setFunctionType(v.value), []);
  const functions = functionsQuery.data?.data ?? [];

  const onSlowestFunctionClick = useCallback(() => {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: `profiling_transaction.suspect_functions_table`,
    });
  }, [organization]);

  return (
    <SlowestFunctionsContainer>
      <SlowestFunctionsTitleContainer>
        <SlowestFunctionsTypeSelect
          value={functionType}
          options={SLOWEST_FUNCTION_OPTIONS}
          onChange={onChangeFunctionType}
          triggerProps={TRIGGER_PROPS}
          offset={4}
        />
        <SlowestFunctionsPagination
          pageLinks={functionsQuery.getResponseHeader?.('Link')}
          onCursor={handleFunctionsCursor}
          size="xs"
        />
      </SlowestFunctionsTitleContainer>
      <SlowestFunctionsList>
        {functionsQuery.isLoading ? (
          <SlowestFunctionsQueryState>
            <LoadingIndicator size={36} />
          </SlowestFunctionsQueryState>
        ) : functionsQuery.isError ? (
          <SlowestFunctionsQueryState>
            {t('Failed to fetch slowest functions')}
          </SlowestFunctionsQueryState>
        ) : !functions.length ? (
          <SlowestFunctionsQueryState>
            {t('Yikes, you have no slow functions? This should not happen.')}
          </SlowestFunctionsQueryState>
        ) : (
          functions.map((fn, i) => {
            return (
              <SlowestFunctionRow key={i}>
                <SlowestFunctionMainRow>
                  <div>
                    <Link
                      onClick={onSlowestFunctionClick}
                      to={generateProfileFlamechartRouteWithQuery({
                        orgSlug: organization.slug,
                        projectSlug: project?.slug ?? '',
                        profileId: (fn['examples()']?.[0] as string) ?? '',
                        query: {
                          // specify the frame to focus, the flamegraph will switch
                          // to the appropriate thread when these are specified
                          frameName: fn.function as string,
                          framePackage: fn.package as string,
                        },
                      })}
                    >
                      <TextTruncateOverflow>{fn.function}</TextTruncateOverflow>
                    </Link>
                  </div>
                  <div>
                    <PerformanceDuration
                      nanoseconds={fn['sum()'] as number}
                      abbreviation
                    />
                  </div>
                </SlowestFunctionMainRow>
                <SlowestFunctionMetricsRow>
                  <div>
                    <TextTruncateOverflow>{fn.package}</TextTruncateOverflow>
                  </div>
                  <div>
                    <Count value={fn['count()'] as number} />
                    {', '}
                    <PerformanceDuration
                      nanoseconds={fn['p75()'] as number}
                      abbreviation
                    />
                  </div>
                </SlowestFunctionMetricsRow>
              </SlowestFunctionRow>
            );
          })
        )}
      </SlowestFunctionsList>
    </SlowestFunctionsContainer>
  );
}

const SlowestFunctionsList = styled('div')`
  flex-basis: 100%;
  overflow: auto;
  min-height: 0;
`;

const SlowestFunctionsContainer = styled('div')`
  margin-top: ${space(0.5)};
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const SlowestFunctionsPagination = styled(Pagination)`
  margin: 0;
`;

const SlowestFunctionsTitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const SlowestFunctionsTypeSelect = styled(CompactSelect)`
  button {
    margin: 0;
    padding: 0;
  }
`;

const SlowestFunctionsQueryState = styled('div')`
  text-align: center;
  padding: ${space(2)} ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const SlowestFunctionRow = styled('div')`
  margin-bottom: ${space(1)};
`;

const SlowestFunctionMainRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SlowestFunctionMetricsRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const TRIGGER_PROPS = {borderless: true, size: 'zero' as const};
const SLOWEST_FUNCTION_OPTIONS: SelectOption<'application' | 'system' | 'all'>[] = [
  {
    label: t('Slowest Application Functions'),
    value: 'application' as const,
  },
  {
    label: t('Slowest System Functions'),
    value: 'system' as const,
  },
  {
    label: t('Slowest Functions'),
    value: 'all' as const,
  },
];
