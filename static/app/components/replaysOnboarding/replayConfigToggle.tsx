import {Flex} from '@sentry/scraps/layout';

import {Switch} from 'sentry/components/core/switch';
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
    <Flex align="center" paddingTop="xs" gap="xl">
      <Flex as="label" align="center" gap="md" htmlFor="mask">
        {t('Mask All Text')}
        <Switch id="mask" onChange={onMaskToggle} size="lg" checked={maskToggle} />
      </Flex>
      <Flex as="label" align="center" gap="md" htmlFor="block">
        {t('Block All Media')}
        <Switch id="block" onChange={onBlockToggle} size="lg" checked={blockToggle} />
      </Flex>
    </Flex>
  );
}

export default ReplayConfigToggle;
