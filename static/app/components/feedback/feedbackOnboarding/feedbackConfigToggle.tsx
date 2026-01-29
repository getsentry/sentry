import {Flex} from 'sentry/components/core/layout/flex';
import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';

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
      <Flex as="label" align="center" gap="md" htmlFor="name">
        {t('Name Required')}
        <Switch id="name" onChange={onNameToggle} size="lg" checked={nameToggle} />
      </Flex>
      <Flex as="label" align="center" gap="md" htmlFor="email">
        {t('Email Required')}
        <Switch id="email" onChange={onEmailToggle} size="lg" checked={emailToggle} />
      </Flex>
      <Flex as="label" align="center" gap="md" htmlFor="screenshot">
        {t('Enable Screenshots')}
        <Switch
          id="screenshot"
          onChange={onScreenshotToggle}
          size="lg"
          checked={screenshotToggle}
        />
      </Flex>
    </Flex>
  );
}

export default FeedbackConfigToggle;
