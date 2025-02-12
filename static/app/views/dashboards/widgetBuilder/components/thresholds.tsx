import {Fragment} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  HighlightedText,
  Thresholds,
} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';
import {SectionHeader} from 'sentry/views/dashboards/widgetBuilder/components/common/sectionHeader';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

type ThresholdsSectionProps = {
  dataType?: string;
  dataUnit?: string;
  error?: Record<string, any>;
  setError?: (error: Record<string, any>) => void;
};

function ThresholdsSection({
  dataType,
  dataUnit,
  error,
  setError,
}: ThresholdsSectionProps) {
  const {state, dispatch} = useWidgetBuilderContext();
  return (
    <Fragment>
      <SectionHeader
        title={t('Thresholds')}
        tooltipText={tct(
          'Set thresholds to identify problematic widgets. For example: setting the max values, [thresholdValues] will display a green indicator for results in the range [greenRange], a yellow indicator for results in the range [yellowRange] and a red indicator for results above [redValue].',
          {
            thresholdValues: <HighlightedText>(green: 100, yellow: 200)</HighlightedText>,
            greenRange: <HighlightedText>[0 - 100]</HighlightedText>,
            yellowRange: <HighlightedText>(100 - 200]</HighlightedText>,
            redValue: <HighlightedText>200</HighlightedText>,
          }
        )}
        optional
      />
      <Thresholds
        thresholdsConfig={state.thresholds ?? null}
        onThresholdChange={(maxKey, value) => {
          let newThresholds = cloneDeep(state.thresholds);

          if (!defined(newThresholds) && value) {
            newThresholds = {max_values: {}, unit: null};
          }

          if (newThresholds) {
            if (value) {
              newThresholds.max_values[maxKey] = parseInt(value, 10);
            } else {
              delete newThresholds.max_values[maxKey];
            }
          }

          // Check if the value cleared all of the max values
          if (
            newThresholds &&
            Object.values(newThresholds.max_values).every(
              nextMaxValue => !defined(nextMaxValue)
            )
          ) {
            newThresholds = undefined;
          }

          setError?.({...error, thresholds: {[maxKey]: ''}});

          dispatch({
            type: BuilderStateAction.SET_THRESHOLDS,
            payload: newThresholds,
          });
        }}
        onUnitChange={unit => {
          dispatch({
            type: BuilderStateAction.SET_THRESHOLDS,
            payload: {
              max_values: state.thresholds?.max_values ?? {},
              unit,
            },
          });
        }}
        dataType={dataType}
        dataUnit={dataUnit}
        errors={error?.thresholds}
      />
    </Fragment>
  );
}

export default ThresholdsSection;
