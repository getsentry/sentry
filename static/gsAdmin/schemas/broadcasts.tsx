import type {Field} from 'sentry/components/forms/types';

import {
  AVAILABLE_PLANCHOICES,
  CATEGORYCHOICES,
  platformOptions,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

const mapChoices = <T extends readonly [string, string]>(choices: readonly T[]) =>
  choices.map(([value, label]) => ({value, label}));

export function getBroadcastSchema(): Field[] {
  return [
    {
      name: 'title',
      type: 'string',
      required: true,
      label: 'Title',
      placeholder: 'e.g. Shiny New Feature',
      maxLength: 64,
    },
    {
      name: 'message',
      type: 'string',
      required: true,
      label: 'Message',
      placeholder: "e.g. Here's a slightly longer sentence about this shiny new feature",
      maxLength: 256,
    },
    {
      name: 'link',
      type: 'string',
      required: true,
      label: 'Link',
      placeholder: 'e.g. https://blog.sentry.io/2021/01/01/shiny-new-feature',
    },
    {
      name: 'mediaUrl',
      type: 'string',
      required: false,
      label: 'Image URL',
      placeholder: 'e.g. https://example.com/image.png',
      help: 'To prevent blurriness, make sure the screenshot focuses on the key feature without including unrelated elements. Resize your browser window if needed before taking the screenshot.',
    },
    {
      name: 'category',
      type: 'choice',
      required: false,
      label: 'Category',
      options: mapChoices(CATEGORYCHOICES),
      allowClear: true,
    },
    {
      name: 'region',
      type: 'choice',
      required: false,
      label: 'Region',
      options: mapChoices(REGIONCHOICES),
      allowClear: true,
    },
    {
      name: 'platform',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Platform',
      options: platformOptions,
    },
    {
      name: 'product',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Product',
      options: mapChoices(PRODUCTCHOICES),
    },
    {
      name: 'roles',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Roles',
      options: mapChoices(ROLECHOICES),
    },
    {
      name: 'plans',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Plans',
      options: mapChoices(AVAILABLE_PLANCHOICES),
    },
    {
      name: 'trialStatus',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Trial Status',
      options: mapChoices(TRIALCHOICES),
    },
    {
      name: 'earlyAdopter',
      type: 'boolean',
      required: false,
      label: 'Early Adopter',
    },
    {
      name: 'dateExpires',
      type: 'datetime',
      required: false,
      label: 'Expires At',
      help: 'The broadcast will automatically deactivate upon expiration.',
    },
    {
      name: 'isActive',
      type: 'boolean',
      required: false,
      help: 'Activate this broadcast immediately.',
    },
  ] as Field[];
}
