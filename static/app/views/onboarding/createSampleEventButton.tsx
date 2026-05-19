import {useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {skipToken, useMutation, useQuery} from '@tanstack/react-query';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

type CreateSampleEventButtonProps = ButtonProps & {
  source: string;
  hasScmOnboarding?: boolean;
  onClick?: () => void;
  onCreateSampleGroup?: () => void;
  project?: Project;
};

const EVENT_POLL_RETRIES = 30;
const EVENT_POLL_INTERVAL = 1000;

function CreateSampleEventButton({
  source,
  hasScmOnboarding,
  onClick,
  onCreateSampleGroup,
  project,
  ...buttonProps
}: CreateSampleEventButtonProps) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const [groupID, setGroupID] = useState<string | null>(null);
  const pollStartTime = useRef(0);
  const retryCount = useRef(0);

  useEffect(() => {
    if (project) {
      trackAnalytics('sample_event.button_viewed', {
        organization,
        project_id: project.id,
        source,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {mutateAsync: createSample} = useMutation({
    mutationFn: () => {
      const url = `/projects/${organization.slug}/${project!.slug}/create-sample/`;
      return fetchMutation<{groupID: string}>({method: 'POST', url});
    },
  });

  const {isSuccess, isError} = useQuery({
    ...apiOptions.as<unknown>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
      {
        path: groupID
          ? {
              organizationIdOrSlug: organization.slug,
              issueId: groupID,
              eventId: 'latest',
            }
          : skipToken,
        staleTime: 0,
      }
    ),
    retry(failureCount) {
      retryCount.current = failureCount + 1;
      return failureCount < EVENT_POLL_RETRIES;
    },
    retryDelay: EVENT_POLL_INTERVAL,
  });

  useEffect(() => {
    if (!groupID || !project) {
      return;
    }

    if (isSuccess) {
      clearIndicators();

      const duration = Math.ceil(performance.now() - pollStartTime.current);
      trackAnalytics('sample_event.created', {
        organization,
        project_id: project.id,
        platform: project.platform || '',
        interval: EVENT_POLL_INTERVAL,
        retries: retryCount.current,
        duration,
        source,
      });

      onClick?.();

      navigate(
        normalizeUrl(
          `/organizations/${organization.slug}/issues/${groupID}/?project=${project.id}&referrer=sample-error`
        )
      );

      setGroupID(null);
    } else if (isError) {
      clearIndicators();

      const retries = retryCount.current;
      const duration = Math.ceil(performance.now() - pollStartTime.current);
      trackAnalytics('sample_event.failed', {
        organization,
        project_id: project.id,
        platform: project.platform || '',
        interval: EVENT_POLL_INTERVAL,
        retries,
        duration,
        source,
      });

      addErrorMessage(t('Failed to load sample event'));

      Sentry.withScope(scope => {
        scope.setTag('groupID', groupID);
        scope.setTag('platform', project.platform || '');
        scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
        scope.setTag('retries', retries.toString());
        scope.setTag('duration', duration.toString());

        scope.setLevel('warning');
        Sentry.captureMessage('Failed to load sample event');
      });

      setGroupID(null);
    }
  }, [groupID, onClick, isSuccess, isError, navigate, organization, project, source]);

  const creating = groupID !== null;

  async function createSampleGroup() {
    if (!project) {
      return;
    }

    if (onCreateSampleGroup) {
      onCreateSampleGroup();
    } else if (hasScmOnboarding) {
      trackAnalytics('onboarding.scm_view_sample_event_clicked', {
        platform: project.platform,
        organization,
      });
    } else {
      trackAnalytics('growth.onboarding_view_sample_event', {
        platform: project.platform,
        organization,
      });
    }

    addLoadingMessage(t('Processing sample event...'), {
      duration: EVENT_POLL_RETRIES * EVENT_POLL_INTERVAL,
    });

    try {
      const eventData = await createSample();
      pollStartTime.current = performance.now();
      retryCount.current = 0;
      setGroupID(eventData.groupID);
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setExtra('error', error);
        Sentry.captureException(new Error('Failed to create sample event'));
      });
      clearIndicators();
      addErrorMessage(t('Failed to create a new sample event'));
    }
  }

  return (
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || creating}
      onClick={createSampleGroup}
    />
  );
}

export {CreateSampleEventButton};
