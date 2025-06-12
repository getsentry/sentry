import type {FieldObject} from 'sentry/components/forms/types';
import slugify from 'sentry/utils/slugify';

export const PolicySchema: FieldObject[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    label: 'Name',
    placeholder: 'e.g. Terms of Service',
  },
  {
    name: 'slug',
    type: 'string',
    required: true,
    label: 'Slug',
    placeholder: 'e.g. terms-of-service',
    transformInput: slugify,
  },
  {
    name: 'active',
    type: 'boolean',
    required: false,
    defaultValue: false,
    label: 'Active',
    help: 'Should this policy be visible to customers?',
  },
  {
    name: 'hasSignature',
    type: 'boolean',
    required: false,
    defaultValue: false,
    label: 'Has Signature',
    help: 'Does this policy require the user accept it?',
  },
];

export const PolicyRevisionSchema: FieldObject[] = [
  {
    name: 'version',
    type: 'string',
    required: false,
    label: 'Version',
    minLength: 3,
    placeholder: 'e.g. 1.0',
  },
  {
    name: 'url',
    type: 'string',
    required: false,
    label: 'URL',
    placeholder: 'e.g. https://example.com/terms-of-service/',
    help: 'If the policy is hosted at an external URL, enter it here.',
  },
  {
    name: 'file',
    type: 'file',
    required: false,
    label: 'File',
    accept: ['.pdf'],
    help: 'Instead of an external URL you may upload the file directly.',
  },
  {
    name: 'current',
    type: 'boolean',
    required: false,
    defaultValue: false,
    label: 'Current',
    help: 'Make this the active version of this policy.',
  },
];
