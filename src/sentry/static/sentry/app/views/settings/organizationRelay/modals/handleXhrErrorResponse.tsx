import {t} from 'app/locale';

type Error = {
  type:
    | 'unknown'
    | 'bad-structure'
    | 'missing-name'
    | 'empty-name'
    | 'missing-key'
    | 'invalid-key'
    | 'duplicated-key';
  message: string;
};

type XhrError = {
  responseJSON?: {
    trustedRelays: Array<string>;
  };
};

function handleError(error: XhrError): Error {
  const errorMessage = error.responseJSON?.trustedRelays[0];

  if (!errorMessage) {
    return {
      type: 'unknown',
      message: t('An unknown error occurred while saving Relay public key.'),
    };
  }

  if (errorMessage === 'Bad structure received for Trusted Relays') {
    return {
      type: 'bad-structure',
      message: t('An invalid structure was sent.'),
    };
  }

  if (errorMessage === 'Relay key info with missing name in Trusted Relays') {
    return {
      type: 'missing-name',
      message: t('Field Required'),
    };
  }

  if (errorMessage === 'Relay key info with empty name in Trusted Relays') {
    return {
      type: 'empty-name',
      message: t('Invalid Field'),
    };
  }

  if (errorMessage.startsWith('Missing public key for Relay key info with name:')) {
    return {
      type: 'missing-key',
      message: t('Field Required'),
    };
  }

  if (errorMessage.startsWith('Invalid public key for relay key info with name:')) {
    return {
      type: 'invalid-key',
      message: t('Invalid Relay key'),
    };
  }

  if (errorMessage.startsWith('Duplicated key in Trusted Relays:')) {
    return {
      type: 'duplicated-key',
      message: t('Relay key already taken'),
    };
  }

  return {
    type: 'unknown',
    message: t('An unknown error occurred while saving Relay public key.'),
  };
}

export default handleError;
