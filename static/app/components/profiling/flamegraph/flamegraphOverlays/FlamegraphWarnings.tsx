import styled from '@emotion/styled';

import {ExportProfileButton} from 'sentry/components/profiling/exportProfileButton';
import {t} from 'sentry/locale';
import type {RequestState} from 'sentry/types/core';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

interface FlamegraphWarningProps {
  flamegraph: Flamegraph;
  requestState: RequestState<any>;
}

export function FlamegraphWarnings(props: FlamegraphWarningProps) {
  const orgSlug = useOrganization().slug;
  const params = useParams();

  if (props.requestState.type === 'loading') {
    return null;
  }

  if (props.requestState.type === 'errored') {
    return (
      <Overlay>
        <p>{props.requestState.error || t('Failed to load profile')}</p>
      </Overlay>
    );
  }

  // A profile may be empty while we are fetching it from the network; while that is happening an empty profile is
  // passed down to the view so that all the components can be loaded and initialized ahead of time.
  if (props.flamegraph.profile.isEmpty()) {
    return null;
  }

  if (props.flamegraph.profile.samples.length === 0) {
    return (
      <Overlay>
        <p>
          {t(
            'This profile either has no samples or the total duration of frames in the profile is 0.'
          )}
        </p>
        <div>
          <ExportProfileButton
            variant="default"
            eventId={params.eventId}
            orgId={orgSlug}
            size="sm"
            projectId={params.projectId}
            title={undefined}
            disabled={params.eventId === undefined || params.projectId === undefined}
          >
            {t('Export Raw Profile')}
          </ExportProfileButton>
        </div>
      </Overlay>
    );
  }

  return null;
}

const Overlay = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid: auto/50%;
  place-content: center;
  z-index: ${p => p.theme.zIndex.initial};
  text-align: center;
`;
