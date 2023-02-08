import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {SelectOption} from 'sentry/components/compactSelect';
import CompositeSelect from 'sentry/components/compactSelect/composite';
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
  const {colorCoding, xAxis, type} = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

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
        closeOnSelect={false}
      >
        <CompositeSelect.Region
          label={t('X Axis')}
          value={xAxis}
          options={xAxisOptions.map(opt => ({
            ...opt,
            disabled: opt.value === 'transaction' && type === 'flamegraph',
          }))}
          onChange={value =>
            dispatch({
              type: 'set xAxis',
              payload: value,
            })
          }
        />
        <CompositeSelect.Region
          label={t('Color Coding')}
          value={colorCoding}
          options={colorCodingOptions}
          onChange={value =>
            dispatch({
              type: 'set color coding',
              payload: value,
            })
          }
        />
      </CompositeSelect>
    </Fragment>
  );
}

const xAxisOptions: SelectOption<FlamegraphPreferences['xAxis']>[] = [
  {value: 'profile', label: t('Profile')},
  {value: 'transaction', label: t('Transaction')},
];

const colorCodingOptions: SelectOption<FlamegraphPreferences['colorCoding']>[] = [
  {value: 'by symbol name', label: t('By Symbol Name')},
  {value: 'by library', label: t('By Package')},
  {value: 'by system frame', label: t('By System Frame')},
  {value: 'by application frame', label: t('By Application Frame')},
  {value: 'by recursion', label: t('By Recursion')},
  {value: 'by frequency', label: t('By Frequency')},
];

export {FlamegraphOptionsMenu};
