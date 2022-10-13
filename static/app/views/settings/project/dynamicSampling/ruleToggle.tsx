import styled from '@emotion/styled';

import NewBooleanField from 'sentry/components/forms/fields/booleanField';
import Placeholder from 'sentry/components/placeholder';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  disabled: boolean;
  loadingRecommendedSdkUpgrades: boolean;
  disabledReason?: string;
  onClick?: () => void;
  value?: boolean;
};

export function RuleToggle({
  onClick,
  value,
  disabled,
  disabledReason,
  loadingRecommendedSdkUpgrades,
}: Props) {
  if (loadingRecommendedSdkUpgrades) {
    return <ActivateTogglePlaceholder />;
  }

  return (
    <Tooltip disabled={!disabled} title={disabledReason}>
      <ActiveToggle
        inline={false}
        hideControlState
        aria-label={value ? t('Deactivate Rule') : t('Activate Rule')}
        onClick={onClick}
        name="active"
        disabled={disabled}
        value={value}
      />
    </Tooltip>
  );
}

const ActivateTogglePlaceholder = styled(Placeholder)`
  height: 24px;
  margin-top: ${space(0.5)};
`;

const ActiveToggle = styled(NewBooleanField)`
  padding: 0;
  height: 34px;
  justify-content: center;
`;
