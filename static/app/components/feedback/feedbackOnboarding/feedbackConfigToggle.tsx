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
