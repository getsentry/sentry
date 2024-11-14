import {t} from 'sentry/locale';
import {createForm} from 'sentry/views/settings/dynamicSampling/utils/formContext';

type FormFields = {
  projectRates: {[id: string]: string};
};

type FormErrors = {
  projectRates: Record<string, string>;
};

export const projectSamplingForm = createForm<FormFields, FormErrors>({
  validators: {
    projectRates: value => {
      const errors: Record<string, string> = {};

      Object.entries(value).forEach(([projectId, rate]) => {
        if (rate === '') {
          errors[projectId] = t('This field is required');
        }

        const numericRate = Number(rate);
        if (isNaN(numericRate)) {
          errors[projectId] = t('Please enter a valid number');
        }

        if (numericRate < 0 || numericRate > 100) {
          errors[projectId] = t('Must be between 0% and 100%');
        }
      });

      return Object.keys(errors).length === 0 ? undefined : errors;
    },
  },
});
