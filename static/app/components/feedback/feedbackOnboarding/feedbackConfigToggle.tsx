import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

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
      <Flex as="label" align="center" gap="sm" htmlFor="name">
        {t('Name Required')}
        <Switch id="name" onChange={onNameToggle} size="lg" checked={nameToggle} />
      </Flex>
      <Flex as="label" align="center" gap="sm" htmlFor="email">
        {t('Email Required')}
        <Switch id="email" onChange={onEmailToggle} size="lg" checked={emailToggle} />
      </Flex>
      <Flex as="label" align="center" gap="sm" htmlFor="screenshot">
        {t('Enable Screenshots')}
        <Switch
          id="screenshot"
          onChange={onScreenshotToggle}
          size="lg"
          checked={screenshotToggle}
        />
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

export default FeedbackConfigToggle;
