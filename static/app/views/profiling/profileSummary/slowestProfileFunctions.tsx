import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Frame} from 'sentry/utils/profiling/frame';
import type {EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

const SLOWEST_FUNCTIONS_LIMIT = 15;
const SLOWEST_FUNCTIONS_CURSOR = 'functionsCursor';

const functionsFields = [
  'package',
  'function',
  'count()',
  'p75()',
  'sum()',
  'all_examples()',
] as const;

type FunctionsField = (typeof functionsFields)[number];
interface SlowestProfileFunctionsProps {
  transaction: string;
}

export function SlowestProfileFunctions(props: SlowestProfileFunctionsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const [functionType, setFunctionType] = useState<'application' | 'system' | 'all'>(
    'application'
  );
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

  const handleFunctionsCursor = useCallback(
    (cursor: any, pathname: any, query: any) =>
      navigate({
        pathname,
        query: {...query, [SLOWEST_FUNCTIONS_CURSOR]: cursor},
      }),
    [navigate]
  );

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

  const onChangeFunctionType = useCallback((v: any) => setFunctionType(v.value), []);
  const functions = functionsQuery.data?.data ?? [];

  const onSlowestFunctionClick = useCallback(() => {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: `profiling_transaction.slowest_functions_table`,
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
        {functionsQuery.isPending ? (
          <SlowestFunctionsQueryState>
            <LoadingIndicator size={36} />
          </SlowestFunctionsQueryState>
        ) : functionsQuery.isError ? (
          <SlowestFunctionsQueryState>
            {t('Failed to fetch slowest functions')}
          </SlowestFunctionsQueryState>
        ) : !functions.length ? (
          <SlowestFunctionsQueryState>
            {t('The fastest code is one that never runs.')}
          </SlowestFunctionsQueryState>
        ) : (
          functions.map((fn, i) => {
            return (
              <SlowestFunctionEntry
                key={i}
                func={fn}
                organization={organization}
                project={project}
                onSlowestFunctionClick={onSlowestFunctionClick}
              />
            );
          })
        )}
      </SlowestFunctionsList>
    </SlowestFunctionsContainer>
  );
}

interface SlowestFunctionEntryProps {
  func: EventsResultsDataRow<'function' | 'package' | 'count()' | 'p75()' | 'sum()'>;
  onSlowestFunctionClick: () => void;
  organization: Organization;
  project: Project | null;
}
function SlowestFunctionEntry(props: SlowestFunctionEntryProps) {
  const frame = useMemo(() => {
    return new Frame(
      {
        key: 0,
        name: props.func.function as string,
        package: props.func.package as string,
      },
      // Ensures that the frame runs through the normalization code path
      props.project?.platform && /node|javascript/.test(props.project.platform)
        ? props.project.platform
        : undefined,
      'aggregate'
    );
  }, [props.func, props.project]);

  let rendered = <TextTruncateOverflow>{frame.name}</TextTruncateOverflow>;
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const example = props.func['all_examples()']?.[0];
  if (defined(example)) {
    const target = generateProfileRouteFromProfileReference({
      orgSlug: props.organization.slug,
      projectSlug: props.project?.slug ?? '',
      frameName: frame.name as string,
      framePackage: frame.package as string,
      reference: example,
    });
    rendered = (
      <Link onClick={props.onSlowestFunctionClick} to={target}>
        {rendered}
      </Link>
    );
  }

  return (
    <SlowestFunctionRow>
      <SlowestFunctionMainRow>
        <div>{rendered}</div>
        <div>
          <PerformanceDuration nanoseconds={props.func['sum()'] as number} abbreviation />
        </div>
      </SlowestFunctionMainRow>
      <SlowestFunctionMetricsRow>
        <div>
          <TextTruncateOverflow>{frame.package}</TextTruncateOverflow>
        </div>
        <div>
          <Count value={props.func['count()'] as number} />{' '}
          {tn('time', 'times', props.func['count()'])}
          {', '}
          <PerformanceDuration nanoseconds={props.func['p75()'] as number} abbreviation />
        </div>
      </SlowestFunctionMetricsRow>
    </SlowestFunctionRow>
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
  padding: 0 ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SlowestFunctionsPagination = styled(Pagination)`
  margin: 0;

  button {
    height: 16px;
    width: 16px;
    min-width: 16px;
    min-height: 16px;

    svg {
      width: 10px;
      height: 10px;
    }
  }
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

  > div:first-child {
    min-width: 0;
  }
  > div:last-child {
    white-space: nowrap;
  }
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
