import {t} from 'sentry/locale';
import {createForm} from 'sentry/views/settings/dynamicSampling/formContext';

type FormFields = {
  samplingMode: 'auto' | 'manual';
  targetSampleRate: string;
};

export const dynamicSamplingForm = createForm<FormFields>({
  validators: {
    targetSampleRate: (value: string) => {
      if (value === '') {
        return t('This field is required.');
      }

      const numericValue = Number(value);
      if (isNaN(numericValue) ? t('Please enter a valid number.') : undefined) {
        return t('Please enter a valid number.');
      }

      if (numericValue < 0 || numericValue > 100) {
        return t('The sample rate must be between 0% and 100%');
      }
      return undefined;
    },
  },
});
