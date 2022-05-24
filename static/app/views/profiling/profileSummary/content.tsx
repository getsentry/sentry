import {useMemo} from 'react';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {FunctionsTable} from 'sentry/components/profiling/functionsTable';
import {ProfilesTable} from 'sentry/components/profiling/profilesTable';
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
      <ProfilesTable
        error={profiles.type === 'errored' ? profiles.error : null}
        isLoading={profiles.type === 'initial' || profiles.type === 'loading'}
        pageLinks={profiles.type === 'resolved' ? profiles.data.pageLinks : null}
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

export {ProfileSummaryContent};
