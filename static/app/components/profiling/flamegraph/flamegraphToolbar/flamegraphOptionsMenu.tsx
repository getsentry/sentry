import {Fragment, useCallback, useMemo} from 'react';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconChevron, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
  profileType: 'transaction profile' | 'continuous profile';
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
  profileType,
}: FlamegraphOptionsMenuProps): React.ReactElement {
  const location = useLocation();
  const organization = useOrganization();
  const {colorCoding} = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  const onColorChange = useCallback(
    (opt: SelectOption<any>) => {
      dispatch({
        type: 'set color coding',
        payload: opt.value,
      });
    },
    [dispatch]
  );

  const onResetZoom = useCallback(() => {
    canvasPoolManager.dispatch('reset zoom', []);
    trackAnalytics('profiling_views.flamegraph.zoom.reset', {
      organization,
      profile_type: profileType,
    });
  }, [canvasPoolManager, organization, profileType]);

  const continuousLocationDescriptor: {end: string; start: string} | null = useMemo(
    () => {
      if (
        typeof location.query.start !== 'string' ||
        typeof location.query.end !== 'string' ||
        typeof location.query.profilerId !== 'string'
      ) {
        return null;
      }

      return {
        start: new Date(location.query.start).toISOString(),
        end: new Date(location.query.end).toISOString(),
      };
    },
    // DO NOT CHANGE THE DEPENDENCY LIST TO `[location.query]`
    //
    // Not 100% sure what's causing it yet but when interacting with the flamegraph,
    // sometimes, the `location.query` reference changes non stop causing an
    // Maximum update depth exceeded error.
    //
    // By depenending on the individual values, which are strings, this becomes stable.
    [location.query.profilerId, location.query.start, location.query.end]
  );

  return (
    <Fragment>
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} icon={<IconSliders />} size="xs">
            {t('Color Coding')}
          </OverlayTrigger.Button>
        )}
        options={colorCodingOptions}
        position="bottom-end"
        value={colorCoding}
        closeOnSelect={false}
        onChange={onColorChange}
      />
      {continuousLocationDescriptor ? (
        <LinkButton
          to={{
            ...location,
            query: {
              ...location.query,
              start: new Date(
                new Date(continuousLocationDescriptor.start).getTime() - 30 * 60 * 1000
              ).toISOString(),
            },
          }}
          size="xs"
          icon={<IconChevron direction="left" />}
          aria-label={t('View Previous 30 Minutes')}
          title={t('View Previous 30 Minutes')}
        />
      ) : null}
      {continuousLocationDescriptor ? (
        <LinkButton
          to={{
            ...location,
            query: {
              ...location.query,
              end: new Date(
                new Date(continuousLocationDescriptor.end).getTime() + 30 * 60 * 1000
              ).toISOString(),
            },
          }}
          size="xs"
          icon={<IconChevron direction="right" />}
          aria-label={t('View Next 30 Minutes')}
          title={t('View Next 30 Minutes')}
        />
      ) : null}
    </Fragment>
  );
}

const colorCodingOptions: Array<SelectOption<FlamegraphPreferences['colorCoding']>> = [
  {value: 'by system vs application frame', label: t('By System vs Application Frame')},
  {value: 'by symbol name', label: t('By Symbol Name')},
  {value: 'by library', label: t('By Package')},
  {value: 'by system frame', label: t('By System Frame')},
  {value: 'by application frame', label: t('By Application Frame')},
  {value: 'by recursion', label: t('By Recursion')},
  {value: 'by frequency', label: t('By Frequency')},
];

export {FlamegraphOptionsMenu};
