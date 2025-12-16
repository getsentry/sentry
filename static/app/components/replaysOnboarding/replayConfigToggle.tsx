import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Switch} from 'sentry/components/core/switch';
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
      <Flex as="label" align="center" gap="sm" htmlFor="mask">
        {t('Mask All Text')}
        <Switch id="mask" onChange={onMaskToggle} size="lg" checked={maskToggle} />
      </Flex>
      <Flex as="label" align="center" gap="sm" htmlFor="block">
        {t('Block All Media')}
        <Switch id="block" onChange={onBlockToggle} size="lg" checked={blockToggle} />
      </Flex>
    </SwitchWrapper>
  );
}

const SwitchWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  padding-top: ${space(0.5)};
`;

export default ReplayConfigToggle;
