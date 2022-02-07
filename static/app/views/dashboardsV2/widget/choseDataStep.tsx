import {t} from 'sentry/locale';
import RadioField from 'sentry/views/settings/components/forms/radioField';

import BuildStep from './buildStep';
import {DataSet} from './utils';

const dataSetChoices: [string, string][] = [
  [DataSet.EVENTS, t('Events')],
  [DataSet.METRICS, t('Metrics')],
];

type Props = {
  onChange: (value: DataSet) => void;
  value: DataSet;
};

function ChooseDataSetStep({value, onChange}: Props) {
  return (
    <BuildStep
      title={t('Choose your data set')}
      description={t(
        'Monitor specific events such as errors and transactions or get metric readings on TBD.'
      )}
    >
      <RadioField
        name="dataSet"
        onChange={onChange}
        value={value}
        choices={dataSetChoices}
        inline={false}
        orientInline
        hideControlState
        stacked
      />
    </BuildStep>
  );
}

export default ChooseDataSetStep;
