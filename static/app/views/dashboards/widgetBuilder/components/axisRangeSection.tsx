import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {AXIS_RANGE_AUTO} from 'sentry/views/dashboards/utils/axisRange';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function AxisRangeSection() {
  const {state, dispatch} = useWidgetBuilderContext();
  const datasetConfig = getDatasetConfig(state.dataset);
  const value = state.axisRange ?? datasetConfig.axisRange ?? AXIS_RANGE_AUTO;

  return (
    <Flex
      as="label"
      align="center"
      gap="sm"
      style={{marginTop: space(1), cursor: 'pointer'}}
    >
      <Checkbox
        checked={value === 'dataMin'}
        onChange={e => {
          dispatch({
            type: BuilderStateAction.SET_AXIS_RANGE,
            payload: e.target.checked ? 'dataMin' : 'auto',
          });
        }}
      />
      {t('Fit Y-Axis to data')}
    </Flex>
  );
}

export default AxisRangeSection;
