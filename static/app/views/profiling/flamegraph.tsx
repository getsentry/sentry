import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {Flamegraph} from 'sentry/components/profiling/flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/fullScreenFlamegraphContainer';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/flamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type RequestState = 'initial' | 'loading' | 'resolved' | 'errored';

function fetchFlamegraphs(
  api: Client,
  eventId: string,
  projectId: Project['id'],
  organization: Organization,
  selection: PageFilters
): Promise<ProfileGroup> {
  return api
    .requestPromise(
      `/organizations/${organization.slug}/${projectId}/profiling/profiles/${eventId}`,
      {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: selection.projects,
        },
      }
    )
    .then(([data]) => importProfile(data, eventId));
}

interface FlamegraphViewProps {
  eventId: Trace['id'];
  location: Location;
  projectId: Project['id'];
  selection?: PageFilters;
}

function FlamegraphView(props: FlamegraphViewProps): React.ReactElement {
  const api = useApi();
  const organization = useOrganization();

  const [profiles, setProfiles] = useState<ProfileGroup | null>(null);
  const [requestState, setRequestState] = useState<RequestState>('initial');

  useEffect(() => {
    if (!props.selection) {
      return;
    }

    api.clear();
    setRequestState('loading');

    fetchFlamegraphs(api, props.eventId, '', organization, props.selection)
      .then(importedFlamegraphs => {
        setProfiles(importedFlamegraphs);
        setRequestState('resolved');
      })
      .catch(() => setRequestState('errored'));
  }, [props.eventId]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <FlamegraphPreferencesProvider>
        <FlamegraphThemeProvider>
          <FullScreenFlamegraphContainer>
            {requestState === 'errored' ? (
              <Alert type="error" icon={<IconFlag size="md" />}>
                {t('Unable to load profiles')}
              </Alert>
            ) : requestState === 'loading' ? (
              <TransparentLoadingMask visible />
            ) : requestState === 'resolved' && profiles ? (
              <Flamegraph profiles={profiles} />
            ) : null}
          </FullScreenFlamegraphContainer>
        </FlamegraphThemeProvider>
      </FlamegraphPreferencesProvider>
    </SentryDocumentTitle>
  );
}

export default FlamegraphView;
