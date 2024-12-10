import {t} from 'sentry/locale';
import {createForm} from 'sentry/views/settings/dynamicSampling/utils/formContext';

type FormFields = {
  targetSampleRate: string;
};

export const organizationSamplingForm = createForm<FormFields>({
  validators: {
    targetSampleRate: (value: string) => {
      if (value === '') {
        return t('This field is required.');
      }

      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        return t('Please enter a valid number.');
      }

      if (numericValue < 0 || numericValue > 100) {
        return t('Must be between 0% and 100%');
      }
      return undefined;
    },
  },
});
