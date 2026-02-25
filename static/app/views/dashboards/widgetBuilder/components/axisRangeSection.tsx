import RadioGroup from 'sentry/components/forms/controls/radioGroup';
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
      <RadioGroup
        label=""
        value={value}
        orientInline
        choices={[
          ['auto' as const, t('Auto')],
          ['dataMin' as const, t('Fit to data')],
        ]}
        onChange={selected => {
          dispatch({
            type: BuilderStateAction.SET_AXIS_RANGE,
            payload: selected,
          });
        }}
      />
    </div>
  );
}

export default AxisRangeSection;
