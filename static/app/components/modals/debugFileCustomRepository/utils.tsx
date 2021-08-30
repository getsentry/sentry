import * as Sentry from '@sentry/react';

import ExternalLink from 'app/components/links/externalLink';
import {
  AWS_REGIONS,
  DEBUG_SOURCE_CASINGS,
  DEBUG_SOURCE_LAYOUTS,
} from 'app/data/debugFileSources';
import {t, tct} from 'app/locale';
import {CustomRepoType} from 'app/types/debugFiles';
import {Field} from 'app/views/settings/components/forms/type';

function objectToChoices(obj: Record<string, string>): [key: string, value: string][] {
  return Object.entries(obj).map(([key, value]) => [key, t(value)]);
}
type FieldMap = Record<string, Field>;

const commonFields: FieldMap = {
  id: {
    name: 'id',
    type: 'hidden',
    required: true,
    defaultValue: () => Math.random().toString(36).substring(2),
  },
  name: {
    name: 'name',
    type: 'string',
    required: true,
    label: t('Name'),
    placeholder: t('New Repository'),
    help: t('A display name for this repository'),
  },
  // filters are explicitly not exposed to the UI
  layoutType: {
    name: 'layout.type',
    type: 'select',
    label: t('Directory Layout'),
    help: t('The layout of the folder structure.'),
    defaultValue: 'native',
    choices: objectToChoices(DEBUG_SOURCE_LAYOUTS),
  },
  layoutCasing: {
    name: 'layout.casing',
    type: 'select',
    label: t('Path Casing'),
    help: t('The case of files and folders.'),
    defaultValue: 'default',
    choices: objectToChoices(DEBUG_SOURCE_CASINGS),
  },
  prefix: {
    name: 'prefix',
    type: 'string',
    label: 'Root Path',
    placeholder: '/',
    help: t('The path at which files are located within this repository.'),
  },
  separator: {
    name: '',
    type: 'separator',
  },
};

export function getFormFieldsAndInitialData(
  type: CustomRepoType,
  sourceConfig?: Record<string, any>
) {
  const {password, secret_key, layout, private_key, ...config} = sourceConfig ?? {};
  const initialData = layout
    ? {...config, 'layout.casing': layout.casing, 'layout.type': layout.type}
    : config;

  switch (type) {
    case 'http':
      return {
        fields: [
          commonFields.id,
          commonFields.name,
          commonFields.separator,
          {
            name: 'url',
            type: 'url',
            required: true,
            label: t('Download Url'),
            placeholder: 'https://msdl.microsoft.com/download/symbols/',
            help: t('Full URL to the symbol server'),
          },
          {
            name: 'username',
            type: 'string',
            required: false,
            label: t('User'),
            placeholder: 'admin',
            help: t('User for HTTP basic auth'),
          },
          {
            name: 'password',
            type: 'string',
            required: false,
            label: t('Password'),
            placeholder:
              typeof password === 'object'
                ? `${'('}${t('Password unchanged')}${')'}`
                : 'open-sesame',
            help: t('Password for HTTP basic auth'),
          },
          commonFields.separator,
          commonFields.layoutType,
          commonFields.layoutCasing,
        ],
        initialData: !initialData
          ? undefined
          : {
              ...initialData,
              password: typeof password === 'object' ? undefined : password,
            },
      };
    case 's3':
      return {
        fields: [
          commonFields.id,
          commonFields.name,
          commonFields.separator,
          {
            name: 'bucket',
            type: 'string',
            required: true,
            label: t('Bucket'),
            placeholder: 's3-bucket-name',
            help: t(
              'Name of the S3 bucket. Read permissions are required to download symbols.'
            ),
          },
          {
            name: 'region',
            type: 'select',
            required: true,
            label: t('Region'),
            help: t('The AWS region and availability zone of the bucket.'),
            choices: AWS_REGIONS.map(([k, v]) => [
              k,
              <span key={k}>
                <code>{k}</code> {v}
              </span>,
            ]),
          },
          {
            name: 'access_key',
            type: 'string',
            required: true,
            label: t('Access Key ID'),
            placeholder: 'AKIAIOSFODNN7EXAMPLE',
            help: tct(
              'Access key to the AWS account. Credentials can be managed in the [link].',
              {
                link: (
                  <ExternalLink href="https://console.aws.amazon.com/iam/">
                    IAM console
                  </ExternalLink>
                ),
              }
            ),
          },
          {
            name: 'secret_key',
            type: 'string',
            required: true,
            label: t('Secret Access Key'),
            placeholder:
              typeof secret_key === 'object'
                ? `${'('}${t('Secret Access Key unchanged')}${')'}`
                : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          },
          commonFields.separator,
          commonFields.prefix,
          commonFields.layoutType,
          commonFields.layoutCasing,
        ],
        initialData: !initialData
          ? undefined
          : {
              ...initialData,
              secret_key: typeof secret_key === 'object' ? undefined : secret_key,
            },
      };
    case 'gcs':
      return {
        fields: [
          commonFields.id,
          commonFields.name,
          commonFields.separator,
          {
            name: 'bucket',
            type: 'string',
            required: true,
            label: t('Bucket'),
            placeholder: 'gcs-bucket-name',
            help: t(
              'Name of the GCS bucket. Read permissions are required to download symbols.'
            ),
          },
          {
            name: 'client_email',
            type: 'email',
            required: true,
            label: t('Client Email'),
            placeholder: 'user@project.iam.gserviceaccount.com',
            help: t('Email address of the GCS service account.'),
          },
          {
            name: 'private_key',
            type: 'string',
            required: true,
            multiline: true,
            autosize: true,
            maxRows: 5,
            rows: 3,
            label: t('Private Key'),
            placeholder:
              typeof private_key === 'object'
                ? `${'('}${t('Private Key unchanged')}${')'}`
                : '-----BEGIN PRIVATE KEY-----\n[PRIVATE-KEY]\n-----END PRIVATE KEY-----',
            help: tct(
              'The service account key. Credentials can be managed on the [link].',
              {
                link: (
                  <ExternalLink href="https://console.cloud.google.com/project/_/iam-admin">
                    IAM &amp; Admin Page
                  </ExternalLink>
                ),
              }
            ),
          },
          commonFields.separator,
          commonFields.prefix,
          commonFields.layoutType,
          commonFields.layoutCasing,
        ],
        initialData: !initialData
          ? undefined
          : {
              ...initialData,
              private_key: typeof private_key === 'object' ? undefined : private_key,
            },
      };
    default: {
      Sentry.captureException(new Error('Unknown custom repository type'));
      return {}; // this shall never happen
    }
  }
}

export function getFinalData(type: CustomRepoType, data: Record<string, any>) {
  switch (type) {
    case 'http':
      return {
        ...data,
        password: data.password ?? {
          'hidden-secret': true,
        },
      };
    case 's3':
      return {
        ...data,
        secret_key: data.secret_key ?? {
          'hidden-secret': true,
        },
      };
    case 'gcs':
      return {
        ...data,
        private_key: data.private_key ?? {
          'hidden-secret': true,
        },
      };
    default: {
      Sentry.captureException(new Error('Unknown custom repository type'));
      return {}; // this shall never happen
    }
  }
}
