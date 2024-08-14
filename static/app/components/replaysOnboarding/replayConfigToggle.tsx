import styled from '@emotion/styled';

import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';

function ReplayConfigToggle({
  maskToggle,
  onMaskToggle,
  blockToggle,
  onBlockToggle,
}: {
  blockToggle: boolean;
  maskToggle: boolean;
  onBlockToggle: () => void;
  onMaskToggle: () => void;
}) {
  return (
    <SwitchWrapper>
      <SwitchItem htmlFor="mask">
        {t('Mask All Text')}
        <Switch id="mask" toggle={onMaskToggle} size="lg" isActive={maskToggle} />
      </SwitchItem>
      <SwitchItem htmlFor="block">
        {t('Block All Media')}
        <Switch id="block" toggle={onBlockToggle} size="lg" isActive={blockToggle} />
      </SwitchItem>
    </SwitchWrapper>
  );
}

const SwitchItem = styled('label')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space(1)};
`;

const SwitchWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space(2)};
  padding-top: ${p => p.theme.space(0.5)};
`;

export default ReplayConfigToggle;
