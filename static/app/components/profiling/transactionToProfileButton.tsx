import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {RequestState} from 'sentry/types/core';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  orgId: string;
  projectId: string;
  transactionId: string;
}

function TransactionToProfileButton({transactionId, orgId, projectId}: Props) {
  const api = useApi();
  const organization = useOrganization();

  const [profileIdState, setProfileIdState] = useState<RequestState<string>>({
    type: 'initial',
  });

  useEffect(() => {
    fetchProfileId(api, transactionId, orgId, projectId)
      .then((profileId: ProfileId) => {
        setProfileIdState({type: 'resolved', data: profileId.profile_id});
      })
      .catch(err => {
        // If there isn't a matching profile, we get a 404. No need to raise an error
        // in this case, but we should otherwise.
        if (err.status !== 404) {
          Sentry.captureException(err);
        }
      });
  }, [api, transactionId, orgId, projectId]);

  if (profileIdState.type !== 'resolved') {
    return null;
  }

  function handleGoToProfile() {
    trackAdvancedAnalyticsEvent('profiling_views.go_to_flamegraph', {
      organization,
      source: 'transaction_details',
    });
  }

  const target = generateProfileFlamechartRoute({
    orgSlug: orgId,
    projectSlug: projectId,
    profileId: profileIdState.data,
  });

  return (
    <Button size="sm" onClick={handleGoToProfile} to={target}>
      {t('Go to Profile')}
    </Button>
  );
}

type ProfileId = {
  profile_id: string;
};

function fetchProfileId(
  api: Client,
  transactionId: string,
  orgId: string,
  projectId: string
): Promise<ProfileId> {
  return api.requestPromise(
    `/projects/${orgId}/${projectId}/profiling/transactions/${transactionId}/`,
    {
      method: 'GET',
    }
  );
}

export {TransactionToProfileButton};
