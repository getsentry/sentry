import {t} from 'app/locale';

export enum ErrorType {
  Unknown = 'unknown',
  InvalidSelector = 'invalid-selector',
  RegexParse = 'regex-parse',
}

type Error = {
  type: ErrorType;
  message: string;
};

type XhrError = {
  responseJSON?: Record<string, Array<string>>;
};

function handleError(error: XhrError): Error {
  const errorMessage = error.responseJSON?.relayPiiConfig[0];

  if (!errorMessage) {
    return {
      type: ErrorType.Unknown,
      message: t('Unknown error occurred while saving data scrubbing rule'),
    };
  }

  if (errorMessage.startsWith('invalid selector: ')) {
    for (const line of errorMessage.split('\n')) {
      if (line.startsWith('1 | ')) {
        const selector = line.slice(3);
        return {
          type: ErrorType.InvalidSelector,
          message: t('Invalid source value: %s', selector),
        };
      }
    }
  }

  if (errorMessage.startsWith('regex parse error:')) {
    for (const line of errorMessage.split('\n')) {
      if (line.startsWith('error:')) {
        const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
        return {
          type: ErrorType.RegexParse,
          message: t('Invalid regex: %s', regex),
        };
      }
    }
  }

  return {
    type: ErrorType.Unknown,
    message: t('An unknown error occurred while saving data scrubbing rule'),
  };
}

export default handleError;
