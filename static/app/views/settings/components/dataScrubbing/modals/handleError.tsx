import {t} from 'sentry/locale';

export enum ErrorType {
  UNKNOWN = 'unknown',
  INVALID_SELECTOR = 'invalid-selector',
  REGEX_PARSE = 'regex-parse',
}

type Error = {
  message: string;
  type: ErrorType;
};

type ResponseFields = 'relayPiiConfig';

type ResponseError = {
  responseJSON?: Record<ResponseFields, Array<string>>;
};

function handleError(error: ResponseError): Error {
  const errorMessage = error.responseJSON?.relayPiiConfig[0];

  if (!errorMessage) {
    return {
      type: ErrorType.UNKNOWN,
      message: t('Unknown error occurred while saving data scrubbing rule'),
    };
  }

  if (errorMessage.startsWith('invalid selector: ')) {
    for (const line of errorMessage.split('\n')) {
      if (line.startsWith('1 | ')) {
        const selector = line.slice(3);
        return {
          type: ErrorType.INVALID_SELECTOR,
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
          type: ErrorType.REGEX_PARSE,
          message: t('Invalid regex: %s', regex),
        };
      }
    }
  }

  if (errorMessage.startsWith('Compiled regex exceeds size limit')) {
    return {
      type: ErrorType.REGEX_PARSE,
      message: t('Compiled regex is too large, simplify your regex'),
    };
  }

  return {
    type: ErrorType.UNKNOWN,
    message: t('An unknown error occurred while saving data scrubbing rule'),
  };
}

export default handleError;
