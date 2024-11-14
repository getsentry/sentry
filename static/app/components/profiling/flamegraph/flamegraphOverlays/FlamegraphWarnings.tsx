import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {ExportProfileButton} from 'sentry/components/profiling/exportProfileButton';
import {t, tct} from 'sentry/locale';
import type {RequestState} from 'sentry/types/core';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

interface FlamegraphWarningPropsWithoutFilter {
  flamegraph: Flamegraph;
  requestState: RequestState<any>;
}

interface FlamegraphWarningPropsWithFilter extends FlamegraphWarningPropsWithoutFilter {
  filter: 'application' | 'system' | 'all' | null;
  onResetFilter: () => void;
}

type FlamegraphWarningProps =
  | FlamegraphWarningPropsWithoutFilter
  | FlamegraphWarningPropsWithFilter;

export function FlamegraphWarnings(props: FlamegraphWarningProps) {
  const params = useParams();
  const orgSlug = useOrganization().slug;

  if (props.requestState.type === 'loading') {
    return null;
  }

  if (props.requestState.type === 'errored') {
    return (
      <Overlay data-test-id="flamegraph-warning-overlay">
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
      <Overlay data-test-id="flamegraph-warning-overlay">
        <p>{t('This flamegraph has no data.')}</p>
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

  if ('filter' in props && !props.flamegraph.frames.length) {
    if (props.filter === 'all') {
      return (
        <Overlay data-test-id="flamegraph-warning-overlay">
          <p>{t('This flamegraph has no data.')}</p>
        </Overlay>
      );
    }

    return (
      <Overlay data-test-id="flamegraph-warning-overlay">
        <p>
          {tct(`No frames match the [filter] frame filter`, {
            filter: props.filter,
          })}
        </p>
        {props.onResetFilter ? (
          <div>
            <Button size="sm" onClick={props.onResetFilter}>
              {t('Reset Filter')}
            </Button>
          </div>
        ) : null}
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
