import styled from '@emotion/styled';

import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
      <SwitchItem>
        {t('Mask All Text')}
        <Switch
          id={t('Mask All Text')}
          toggle={onMaskToggle}
          size="lg"
          isActive={maskToggle}
        />
      </SwitchItem>
      <SwitchItem>
        {t('Block All Media')}
        <Switch
          id={t('Block All Media')}
          toggle={onBlockToggle}
          size="lg"
          isActive={blockToggle}
        />
      </SwitchItem>
    </SwitchWrapper>
  );
}

const SwitchItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SwitchWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

export default ReplayConfigToggle;
