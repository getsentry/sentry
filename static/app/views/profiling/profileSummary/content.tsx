import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import {ProfilesTable} from 'sentry/components/profiling/profilesTable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {useProfiles} from 'sentry/utils/profiling/hooks/useProfiles';
import {decodeScalar} from 'sentry/utils/queryString';

const PROFILES_COLUMN_ORDER = [
  'failed' as const,
  'id' as const,
  'timestamp' as const,
  'device_model' as const,
  'device_classification' as const,
  'trace_duration_ms' as const,
];

interface ProfileSummaryContentProps {
  location: Location;
  project: Project;
  query: string;
  transaction: string;
  version: string;
  selection?: PageFilters;
}

function ProfileSummaryContent(props: ProfileSummaryContentProps) {
  const cursor = useMemo(
    () => decodeScalar(props.location.query.cursor),
    [props.location]
  );

  const profiles = useProfiles({
    cursor,
    limit: 5,
    query: props.query,
    selection: props.selection,
  });

  const functions = useFunctions({
    project: props.project,
    query: props.query,
    selection: props.selection,
    transaction: props.transaction,
    version: props.version,
  });

  return (
    <Layout.Main fullWidth>
      <TableHeader>
        <SectionHeading>{t('Recent Profiles')}</SectionHeading>
        <StyledPagination
          pageLinks={profiles.type === 'resolved' ? profiles.data.pageLinks : null}
          size="xsmall"
        />
      </TableHeader>
      <ProfilesTable
        error={profiles.type === 'errored' ? profiles.error : null}
        isLoading={profiles.type === 'initial' || profiles.type === 'loading'}
        traces={profiles.type === 'resolved' ? profiles.data.traces : []}
        columnOrder={PROFILES_COLUMN_ORDER}
      />
      <FunctionsTable
        error={functions.type === 'errored' ? functions.error : null}
        functionCalls={functions.type === 'resolved' ? functions.data : []}
        isLoading={functions.type === 'initial' || functions.type === 'loading'}
        project={props.project}
      />
    </Layout.Main>
  );
}

const TableHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

export {ProfileSummaryContent};
