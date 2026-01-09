import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function FeedbackConfigToggle({
  emailToggle,
  onEmailToggle,
  nameToggle,
  onNameToggle,
  screenshotToggle,
  onScreenshotToggle,
}: {
  emailToggle: boolean;
  nameToggle: boolean;
  onEmailToggle: () => void;
  onNameToggle: () => void;
  onScreenshotToggle: () => void;
  screenshotToggle: boolean;
}) {
  return (
    <Flex align="center" paddingTop="xs" gap="xl">
      <SwitchItem htmlFor="name">
        {t('Name Required')}
        <Switch id="name" onChange={onNameToggle} size="lg" checked={nameToggle} />
      </SwitchItem>
      <SwitchItem htmlFor="email">
        {t('Email Required')}
        <Switch id="email" onChange={onEmailToggle} size="lg" checked={emailToggle} />
      </SwitchItem>
      <SwitchItem htmlFor="screenshot">
        {t('Enable Screenshots')}
        <Switch
          id="screenshot"
          onChange={onScreenshotToggle}
          size="lg"
          checked={screenshotToggle}
        />
      </SwitchItem>
    </Flex>
  );
}

const SwitchItem = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

export default FeedbackConfigToggle;
