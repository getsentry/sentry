import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {RequestState} from 'sentry/types/core';
import {generateProfileFlamegraphRoute} from 'sentry/utils/profiling/routes';
import useApi from 'sentry/utils/useApi';

interface Props {
  orgId: string;
  projectId: string;
  transactionId: string;
}

function TransactionToProfileButton({transactionId, orgId, projectId}: Props) {
  const api = useApi();

  const [profileIdState, setProfileIdState] = useState<RequestState<string>>({
    type: 'initial',
  });

  useEffect(() => {
    fetchProfileId(api, transactionId, orgId, projectId).then((profileId: ProfileId) => {
      setProfileIdState({type: 'resolved', data: profileId.profile_id});
    });
  }, [api, transactionId, orgId, projectId]);

  if (profileIdState.type !== 'resolved') {
    return null;
  }

  const target = generateProfileFlamegraphRoute({
    orgSlug: orgId,
    projectSlug: projectId,
    profileId: profileIdState.data,
  });

  return <Button to={target}>{t('Go to Profile')}</Button>;
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
