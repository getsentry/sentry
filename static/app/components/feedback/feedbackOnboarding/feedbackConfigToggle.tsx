import styled from '@emotion/styled';

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
    <SwitchWrapper>
      <SwitchItem htmlFor="name">
        {t('Name Required')}
        <Switch id="name" toggle={onNameToggle} size="lg" isActive={nameToggle} />
      </SwitchItem>
      <SwitchItem htmlFor="email">
        {t('Email Required')}
        <Switch id="email" toggle={onEmailToggle} size="lg" isActive={emailToggle} />
      </SwitchItem>
      <SwitchItem htmlFor="screenshot">
        {t('Enable Screenshots')}
        <Switch
          id="screenshot"
          toggle={onScreenshotToggle}
          size="lg"
          isActive={screenshotToggle}
        />
      </SwitchItem>
    </SwitchWrapper>
  );
}

const SwitchItem = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SwitchWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  padding-top: ${space(0.5)};
`;

export default FeedbackConfigToggle;
