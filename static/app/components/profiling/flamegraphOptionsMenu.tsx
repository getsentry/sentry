import {Fragment, useMemo} from 'react';

import Button from 'sentry/components/button';
import CompositeSelect from 'sentry/components/compositeSelect';
import {IconSliders} from 'sentry/icons';
import {t} from 'sentry/locale';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
}: FlamegraphOptionsMenuProps): React.ReactElement {
  const {colorCoding, xAxis} = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  const options = useMemo(() => {
    return [
      {
        label: t('X Axis'),
        value: 'x axis',
        defaultValue: xAxis,
        options: Object.entries(X_AXIS).map(([value, label]) => ({
          label,
          value,
        })),
        onChange: value =>
          dispatch({
            type: 'set xAxis',
            payload: value,
          }),
      },
      {
        label: t('Color Coding'),
        value: 'by symbol name',
        defaultValue: colorCoding,
        options: Object.entries(COLOR_CODINGS).map(([value, label]) => ({
          label,
          value,
        })),
        onChange: value =>
          dispatch({
            type: 'set color coding',
            payload: value,
          }),
      },
    ];
    // If we add color and xAxis it updates the memo and the component is re-rendered (losing hovered state)
    // Not ideal, but since we are only passing default value I guess we can live with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <Fragment>
      <Button size="xs" onClick={() => canvasPoolManager.dispatch('reset zoom', [])}>
        {t('Reset Zoom')}
      </Button>
      <CompositeSelect
        triggerLabel={t('Options')}
        triggerProps={{
          icon: <IconSliders size="xs" />,
          size: 'xs',
        }}
        position="bottom-end"
        sections={options}
      />
    </Fragment>
  );
}

const X_AXIS: Record<FlamegraphPreferences['xAxis'], string> = {
  standalone: t('Standalone'),
  transaction: t('Transaction'),
};

const COLOR_CODINGS: Record<FlamegraphPreferences['colorCoding'], string> = {
  'by symbol name': t('By Symbol Name'),
  'by library': t('By Package'),
  'by system / application': t('By System / Application'),
  'by recursion': t('By Recursion'),
  'by frequency': t('By Frequency'),
};

export {FlamegraphOptionsMenu};
