import {Fragment, useCallback} from 'react';

import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
}: FlamegraphOptionsMenuProps): React.ReactElement {
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
