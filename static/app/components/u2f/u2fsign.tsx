import {t} from 'sentry/locale';

import U2fInterface from './u2finterface';

const MESSAGES = {
  signin: t('Sign in with your passkey, biometrics, or security key.'),
  sudo: t('You can also confirm this action using your passkey.'),
  enroll: t('Create a passkey using your device or password manager.'),
};

type InterfaceProps = React.ComponentProps<typeof U2fInterface>;

type Props = Omit<InterfaceProps, 'silentIfUnsupported' | 'flowMode'> & {
  displayMode?: 'signin' | 'enroll' | 'sudo';
};

function U2fSign({displayMode = 'signin', ...props}: Props) {
  const flowMode = displayMode === 'enroll' ? 'enroll' : 'sign';

  return (
    <U2fInterface
      {...props}
      silentIfUnsupported={displayMode === 'sudo'}
      flowMode={flowMode}
    >
      <p>{MESSAGES[displayMode] ?? null}</p>
    </U2fInterface>
  );
}

export default U2fSign;
