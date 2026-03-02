import {Input} from '@sentry/scraps/input';

import {t} from 'sentry/locale';
import type {Action} from 'sentry/views/alerts/rules/metric/types';
import {ActionType, TargetType} from 'sentry/views/alerts/rules/metric/types';

type Props = {
  action: Action;
  disabled: boolean;
  onChange: (value: string) => void;
};

function ActionSpecificTargetSelector({action, disabled, onChange}: Props) {
  const handleChangeSpecificTargetIdentifier = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(e.target.value);
  };

  if (action.targetType !== TargetType.SPECIFIC || action.type !== ActionType.SLACK) {
    return null;
  }
  return (
    <Input
      type="text"
      autoComplete="off"
      disabled={disabled}
      key="inputChannelId"
      value={action.inputChannelId || ''}
      onChange={handleChangeSpecificTargetIdentifier}
      placeholder={t('optional: channel ID or user ID')}
      // Disable 1Password autocomplete
      data-1p-ignore
    />
  );
}

export default ActionSpecificTargetSelector;
