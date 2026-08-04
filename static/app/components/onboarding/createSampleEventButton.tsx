import {useEffect, useRef} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

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

export function CreateSampleEventButton({
  source,
  hasScmOnboarding,
  onClick,
  onCreateSampleGroup,
  project,
  ...buttonProps
}: CreateSampleEventButtonProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organization = useOrganization();
  const pollingAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      pollingAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (project) {
      trackAnalytics('sample_event.button_viewed', {
        organization,
        project_id: project.id,
        source,
      });
    }
  }, [organization, project, source]);

  const {mutate: createSampleGroup, isPending} = useMutation({
    mutationFn: () => {
      const url = `/projects/${organization.slug}/${project!.slug}/create-sample/`;
      return fetchMutation<{groupID: string}>({method: 'POST', url});
    },
    onMutate() {
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
    },
    onSuccess({groupID}) {
      pollingAbortRef.current?.abort();
      const abortController = new AbortController();
      pollingAbortRef.current = abortController;

      const t0 = performance.now();
      let retries = 0;

      queryClient
        .fetchQuery({
          ...apiOptions.as<unknown>()(
            '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
            {
              path: {
                organizationIdOrSlug: organization.slug,
                issueId: groupID,
                eventId: 'latest',
              },
              staleTime: 0,
            }
          ),
          retry(failureCount) {
            if (abortController.signal.aborted) {
              return false;
            }
            retries = failureCount + 1;
            return failureCount < EVENT_POLL_RETRIES;
          },
          retryDelay: EVENT_POLL_INTERVAL,
        })
        .then(() => {
          if (abortController.signal.aborted) {
            return;
          }
          clearIndicators();

          trackAnalytics('sample_event.created', {
            organization,
            project_id: project!.id,
            platform: project!.platform || '',
            interval: EVENT_POLL_INTERVAL,
            retries,
            duration: Math.ceil(performance.now() - t0),
            source,
          });

          onClick?.();

          navigate(
            normalizeUrl(
              `/organizations/${organization.slug}/issues/${groupID}/?project=${project!.id}&referrer=sample-error`
            )
          );
        })
        .catch(() => {
          if (abortController.signal.aborted) {
            return;
          }
          clearIndicators();

          const duration = Math.ceil(performance.now() - t0);
          trackAnalytics('sample_event.failed', {
            organization,
            project_id: project!.id,
            platform: project!.platform || '',
            interval: EVENT_POLL_INTERVAL,
            retries,
            duration,
            source,
          });

          addErrorMessage(t('Failed to load sample event'));

          Sentry.withScope(scope => {
            scope.setTag('groupID', groupID);
            scope.setTag('platform', project!.platform || '');
            scope.setTag('interval', EVENT_POLL_INTERVAL.toString());
            scope.setTag('retries', retries.toString());
            scope.setTag('duration', duration.toString());

            scope.setLevel('warning');
            Sentry.captureMessage('Failed to load sample event');
          });
        });
    },
    onError(error) {
      Sentry.withScope(scope => {
        scope.setExtra('error', error);
        Sentry.captureException(new Error('Failed to create sample event'));
      });
      clearIndicators();
      addErrorMessage(t('Failed to create a new sample event'));
    },
  });

  return (
    <Button
      {...buttonProps}
      disabled={buttonProps.disabled || !project || isPending}
      onClick={() => createSampleGroup()}
    />
  );
}
