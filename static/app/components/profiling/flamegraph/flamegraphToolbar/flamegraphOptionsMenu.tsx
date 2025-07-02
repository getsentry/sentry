import {Fragment, useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {IconChevron, IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useLocation} from 'sentry/utils/useLocation';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
}: FlamegraphOptionsMenuProps): React.ReactElement {
  const location = useLocation();
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
  }, [canvasPoolManager]);

  const continuousLocationDescriptor: {end: string; start: string} | null =
    useMemo(() => {
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
    }, [location.query]);

  return (
    <Fragment>
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <CompactSelect
        triggerLabel={t('Color Coding')}
        triggerProps={{icon: <IconSliders />, size: 'xs'}}
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
          tooltipProps={{
            forceVisible: true,
          }}
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
