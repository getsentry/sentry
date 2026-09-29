import {z} from 'zod';

import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {safeURL} from 'sentry/utils/url/safeURL';

import {
  AVAILABLE_PLANCHOICES,
  CATEGORYCHOICES,
  platformOptions,
  PRODUCTCHOICES,
  REGIONCHOICES,
  ROLECHOICES,
  TRIALCHOICES,
} from 'getsentry/utils/broadcasts';

const TITLE_MAX_LENGTH = 64;
const MESSAGE_MAX_LENGTH = 256;

export const broadcastValidationSchema = z.object({
  title: z.string().max(TITLE_MAX_LENGTH, 'Title must be 64 characters or fewer.'),
  message: z.string().max(MESSAGE_MAX_LENGTH, 'Message must be 256 characters or fewer.'),
  link: z.string().refine(value => Boolean(safeURL(value)), 'Enter a valid URL.'),
  mediaUrl: z
    .string()
    .refine(value => !value || Boolean(safeURL(value)), 'Enter a valid image URL.'),
});

export function getBroadcastSchema(): JsonFormAdapterFieldConfig[] {
  return [
    {
      name: 'title',
      type: 'string',
      required: true,
      label: 'Title',
      placeholder: 'e.g. Shiny New Feature',
      maxLength: TITLE_MAX_LENGTH,
    },
    {
      name: 'message',
      type: 'string',
      required: true,
      label: 'Message',
      placeholder: "e.g. Here's a slightly longer sentence about this shiny new feature",
      maxLength: MESSAGE_MAX_LENGTH,
    },
    {
      name: 'link',
      type: 'string',
      required: true,
      label: 'Link',
      placeholder: 'e.g. https://blog.sentry.io/2021/01/01/shiny-new-feature',
    },
    {
      name: 'organizations',
      type: 'string',
      required: false,
      label: 'Organization IDs',
      placeholder: 'e.g. 123, 456, 789 (leave empty to broadcast to all users)',
      help: 'Comma-separated list of organization IDs to restrict this broadcast to. If left empty, the broadcast will be shown to all users.',
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
      choices: CATEGORYCHOICES,
    },
    {
      name: 'region',
      type: 'choice',
      required: false,
      label: 'Region',
      choices: REGIONCHOICES,
    },
    {
      name: 'platform',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Platform',
      choices: platformOptions.flatMap(group =>
        group.options.map(({value, label}) => [value, label] as const)
      ),
    },
    {
      name: 'product',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Product',
      choices: PRODUCTCHOICES,
    },
    {
      name: 'roles',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Roles',
      choices: ROLECHOICES,
    },
    {
      name: 'plans',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Plans',
      choices: AVAILABLE_PLANCHOICES,
    },
    {
      name: 'trialStatus',
      type: 'choice',
      required: false,
      multiple: true,
      label: 'Trial Status',
      choices: TRIALCHOICES,
    },
    {
      name: 'earlyAdopter',
      type: 'boolean',
      required: false,
      label: 'Early Adopter',
    },
    {
      name: 'dateExpires',
      type: 'datetime-local',
      required: false,
      label: 'Expires At',
      help: 'The broadcast will automatically deactivate upon expiration.',
    },
    {
      name: 'isActive',
      type: 'boolean',
      label: 'Active',
      required: false,
      help: 'Activate this broadcast immediately.',
    },
  ];
}
