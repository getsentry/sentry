import React from 'react';
import styled from 'react-emotion';

import {
  ThresholdControlValue,
  AlertRuleThreshold,
  AlertRuleThresholdType,
} from 'app/views/settings/incidentRules/types';
import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';

type Props = ThresholdControlValue & {
  type: AlertRuleThreshold;
  disabled: boolean;
  onChange: (
    type: AlertRuleThreshold,
    value: ThresholdControlValue,
    e: React.FormEvent
  ) => void;
};

function ThresholdControl({
  thresholdType,
  threshold,
  type,
  onChange,
  disabled,
  ...props
}: Props) {
  const onChangeThresholdType = ({value}, e) => {
    onChange(
      type,
      {thresholdType: getThresholdTypeForThreshold(type, value), threshold},
      e
    );
  };

  const onChangeThreshold = (e: React.ChangeEvent<HTMLInputElement>) => {
    const thresholdAsInt = parseInt(e.target.value, 10);

    onChange(
      type,
      {thresholdType, threshold: isNaN(thresholdAsInt) ? '' : thresholdAsInt},
      e
    );
  };

  const thresholdName = AlertRuleThreshold.INCIDENT === type ? 'alert' : 'resolution';

  return (
    <div {...props}>
      <SelectControl
        disabled={disabled}
        name={`${thresholdName}ThresholdType`}
        value={getThresholdTypeForThreshold(type, thresholdType)}
        options={[
          {value: AlertRuleThresholdType.BELOW, label: t('Below')},
          {value: AlertRuleThresholdType.ABOVE, label: t('Above')},
        ]}
        onChange={onChangeThresholdType}
      />
      <Input
        disabled={disabled}
        name={`${thresholdName}ThresholdInput`}
        type="number"
        placeholder="300"
        value={threshold}
        onChange={onChangeThreshold}
      />
    </div>
  );
}

export default styled(ThresholdControl)`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 3fr;
  grid-gap: ${space(1)};
`;

function getThresholdTypeForThreshold(
  type: AlertRuleThreshold,
  thresholdType: AlertRuleThresholdType
): AlertRuleThresholdType {
  return (type === AlertRuleThreshold.INCIDENT) !==
    (thresholdType === AlertRuleThresholdType.ABOVE)
    ? AlertRuleThresholdType.BELOW
    : AlertRuleThresholdType.ABOVE;
}
