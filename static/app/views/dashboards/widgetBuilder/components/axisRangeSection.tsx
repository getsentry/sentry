import {CompactSelect} from '@sentry/scraps/compactSelect';

import {t} from 'sentry/locale';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

function AxisRangeSection() {
  const {state, dispatch} = useWidgetBuilderContext();
  const datasetConfig = getDatasetConfig(state.dataset);
  const value = state.axisRange ?? datasetConfig.axisRange ?? 'auto';

  return (
    <div>
      <SectionHeader title={t('Y-Axis Range')} />
      <CompactSelect
        value={value}
        options={[
          {value: 'auto' as const, label: t('Auto (start at 0)')},
          {value: 'dataMin' as const, label: t('Fit to data')},
        ]}
        onChange={selection => {
          dispatch({
            type: BuilderStateAction.SET_AXIS_RANGE,
            payload: selection.value,
          });
        }}
      />
    </div>
  );
}

export default AxisRangeSection;
