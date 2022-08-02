import {t} from 'sentry/locale';

import U2fInterface from './u2finterface';

const MESSAGES = {
  signin: t(
    'Insert your U2F device or tap the button on it to confirm the sign-in request.'
  ),
  sudo: t('Alternatively you can use your U2F device to confirm the action.'),
  enroll: t(
    'To enroll your U2F device insert it now or tap the button on it to activate it.'
  ),
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
