import {z} from 'zod';

import type {SelectValue} from '@sentry/scraps/select';

import {t} from 'sentry/locale';

export type ProjectThreshold = {
  metric: string;
  threshold: string;
  editedBy?: string;
  id?: string;
};

export type GeneralSettings = {enable_images?: boolean};

export const generalSettingsSchema = z.object({
  enable_images: z.boolean(),
});

export const thresholdSettingsSchema = z.object({
  metric: z.enum(['duration', 'lcp']).nullable(),
  threshold: z.string(),
});

export type ThresholdMetric = z.infer<typeof thresholdSettingsSchema>['metric'];

export const CALCULATION_METHOD_OPTIONS: Array<SelectValue<ThresholdMetric>> = [
  {value: 'duration', label: t('Transaction Duration')},
  {value: 'lcp', label: t('Largest Contentful Paint')},
];
