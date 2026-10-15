import {z} from 'zod';

import {t} from 'sentry/locale';

export const sampleRateField = z
  .string()
  .min(1, t('Please enter a valid number'))
  .refine(val => !isNaN(Number(val)), {message: t('Please enter a valid number')})
  .refine(
    val => {
      const n = Number(val);
      return n >= 0 && n <= 100;
    },
    {message: t('Must be between 0% and 100%')}
  );

export const targetSampleRateSchema = z.object({
  targetSampleRate: sampleRateField,
});
