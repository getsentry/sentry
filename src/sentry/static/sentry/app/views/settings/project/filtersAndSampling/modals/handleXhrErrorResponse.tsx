import {t} from 'app/locale';
import {DynamicSamplingRule} from 'app/types/dynamicSampling';

type Error = {
  type: 'sampleRate' | 'unknown';
  message: string;
};

type XhrError = {
  responseJSON?: {
    dynamicSampling?: {
      rules: Array<Partial<DynamicSamplingRule>>;
    };
  };
};

function handleXhrErrorResponse(error: XhrError, currentRuleIndex: number): Error {
  const responseErrors =
    error.responseJSON?.dynamicSampling?.rules[currentRuleIndex] ?? {};

  const [type, value] = Object.entries(responseErrors)[0];

  if (type === 'sampleRate') {
    const message = Array.isArray(value) ? value[0] : value;
    if (message === 'Ensure this value is less than or equal to 1.') {
      return {
        type: 'sampleRate',
        message: t('Ensure this value is a floating number between 0 and 100'),
      };
    }
  }

  return {
    type: 'unknown',
    message: t('An internal error occurred while saving dynamic sampling rule'),
  };
}

export default handleXhrErrorResponse;
