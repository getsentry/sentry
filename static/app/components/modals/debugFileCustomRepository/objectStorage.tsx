import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  AWS_REGIONS,
  DEBUG_SOURCE_CASINGS,
  DEBUG_SOURCE_LAYOUTS,
  getDebugSourceName,
} from 'sentry/data/debugFileSources';
import {t, tct} from 'sentry/locale';
import {CustomRepoType} from 'sentry/types/debugFiles';
import {uniqueId} from 'sentry/utils/guid';

const LAYOUT_OPTIONS = Object.entries(DEBUG_SOURCE_LAYOUTS).map(([value, label]) => ({
  value,
  label,
}));

const CASING_OPTIONS = Object.entries(DEBUG_SOURCE_CASINGS).map(([value, label]) => ({
  value,
  label,
}));

const REGION_OPTIONS = AWS_REGIONS.map(([value, label]) => ({
  value: value as string,
  label: (
    <span key={value}>
      <code>{value}</code> {label}
    </span>
  ),
}));

type CommonProps = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  onSubmit: (data: Record<string, any>) => void;
  sourceConfig?: Record<string, any>;
};

function Title({type, isEditing}: {isEditing: boolean; type: CustomRepoType}) {
  const name = getDebugSourceName(type);
  return isEditing
    ? tct('Update [name] Repository', {name})
    : tct('Add [name] Repository', {name});
}

export function S3Repository({
  Header,
  Body,
  Footer,
  onSubmit,
  sourceConfig,
}: CommonProps) {
  const {
    secret_key,
    layout,
    name,
    bucket,
    region,
    access_key,
    prefix,
    id,
    type: _type,
    ...extraConfig
  } = sourceConfig ?? {};

  // A stored secret is returned as `{'hidden-secret': true}`; when present the
  // field is optional (leaving it blank keeps the stored secret).
  const secretAlreadySet = typeof secret_key === 'object';

  const schema = z.object({
    id: z.string(),
    name: z.string().min(1, t('Name is required')),
    bucket: z.string().min(1, t('Bucket is required')),
    region: z
      .string()
      .nullable()
      .refine(value => value !== null, t('Region is required')),
    access_key: z.string().min(1, t('Access Key ID is required')),
    secret_key: secretAlreadySet
      ? z.string()
      : z.string().min(1, t('Secret Access Key is required')),
    prefix: z.string(),
    layoutType: z.string(),
    layoutCasing: z.string(),
  });

  const defaultValues: z.input<typeof schema> = {
    id: id ?? uniqueId(),
    name: name ?? '',
    bucket: bucket ?? '',
    region: region ?? null,
    access_key: access_key ?? '',
    secret_key: '',
    prefix: prefix ?? '',
    layoutType: layout?.type ?? 'native',
    layoutCasing: layout?.casing ?? 'default',
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const data: Record<string, any> = {
        ...extraConfig,
        id: value.id,
        name: value.name,
        bucket: value.bucket,
        region: value.region,
        access_key: value.access_key,
        'layout.type': value.layoutType,
        'layout.casing': value.layoutCasing,
      };
      if (value.prefix) {
        data.prefix = value.prefix;
      }
      if (value.secret_key) {
        data.secret_key = value.secret_key;
      }
      onSubmit(data);
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Title type={CustomRepoType.S3} isEditing={!!sourceConfig} />
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label={t('Name')}
                hintText={t('A display name for this repository')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('New Repository')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="bucket">
            {field => (
              <field.Layout.Stack
                label={t('Bucket')}
                hintText={t(
                  'Name of the S3 bucket. Read permissions are required to download symbols.'
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="s3-bucket-name"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="region">
            {field => (
              <field.Layout.Stack
                label={t('Region')}
                hintText={t('The AWS region and availability zone of the bucket.')}
                required
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={REGION_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="access_key">
            {field => (
              <field.Layout.Stack
                label={t('Access Key ID')}
                hintText={tct(
                  'Access key to the AWS account. Credentials can be managed in the [link].',
                  {
                    link: (
                      <ExternalLink href="https://console.aws.amazon.com/iam/">
                        {t('IAM console')}
                      </ExternalLink>
                    ),
                  }
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="secret_key">
            {field => (
              <field.Layout.Stack
                label={t('Secret Access Key')}
                required={!secretAlreadySet}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={
                    secretAlreadySet
                      ? t('(Secret Access Key unchanged)')
                      : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
                  }
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="prefix">
            {field => (
              <field.Layout.Stack
                label={t('Root Path')}
                hintText={t(
                  'The path at which files are located within this repository.'
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="layoutType">
            {field => (
              <field.Layout.Stack
                label={t('Directory Layout')}
                hintText={t('The layout of the folder structure.')}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={LAYOUT_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="layoutCasing">
            {field => (
              <field.Layout.Stack
                label={t('Path Casing')}
                hintText={t('The case of files and folders.')}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={CASING_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Save changes')}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}

export function GcsRepository({
  Header,
  Body,
  Footer,
  onSubmit,
  sourceConfig,
}: CommonProps) {
  const {
    private_key,
    layout,
    name,
    bucket,
    client_email,
    prefix,
    id,
    type: _type,
    ...extraConfig
  } = sourceConfig ?? {};

  const privateKeyAlreadySet = typeof private_key === 'object';

  const schema = z.object({
    id: z.string(),
    name: z.string().min(1, t('Name is required')),
    bucket: z.string().min(1, t('Bucket is required')),
    client_email: z.string().min(1, t('Client Email is required')),
    private_key: privateKeyAlreadySet
      ? z.string()
      : z.string().min(1, t('Private Key is required')),
    prefix: z.string(),
    layoutType: z.string(),
    layoutCasing: z.string(),
  });

  const defaultValues: z.input<typeof schema> = {
    id: id ?? uniqueId(),
    name: name ?? '',
    bucket: bucket ?? '',
    client_email: client_email ?? '',
    private_key: '',
    prefix: prefix ?? '',
    layoutType: layout?.type ?? 'native',
    layoutCasing: layout?.casing ?? 'default',
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const data: Record<string, any> = {
        ...extraConfig,
        id: value.id,
        name: value.name,
        bucket: value.bucket,
        client_email: value.client_email,
        'layout.type': value.layoutType,
        'layout.casing': value.layoutCasing,
      };
      if (value.prefix) {
        data.prefix = value.prefix;
      }
      if (value.private_key) {
        data.private_key = value.private_key;
      }
      onSubmit(data);
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Title type={CustomRepoType.GCS} isEditing={!!sourceConfig} />
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack
                label={t('Name')}
                hintText={t('A display name for this repository')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('New Repository')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="bucket">
            {field => (
              <field.Layout.Stack
                label={t('Bucket')}
                hintText={t(
                  'Name of the GCS bucket. Read permissions are required to download symbols.'
                )}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="gcs-bucket-name"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="client_email">
            {field => (
              <field.Layout.Stack
                label={t('Client Email')}
                hintText={t('Email address of the GCS service account.')}
                required
              >
                <field.Input
                  type="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="user@project.iam.gserviceaccount.com"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="private_key">
            {field => (
              <field.Layout.Stack
                label={t('Private Key')}
                required={!privateKeyAlreadySet}
              >
                <field.TextArea
                  autosize
                  rows={3}
                  maxRows={5}
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={
                    privateKeyAlreadySet
                      ? t('(Private Key unchanged)')
                      : '-----BEGIN PRIVATE KEY-----\n[PRIVATE-KEY]\n-----END PRIVATE KEY-----'
                  }
                />
                <Text size="sm" variant="muted">
                  {tct(
                    'The service account key. Credentials can be managed on the [link].',
                    {
                      link: (
                        <ExternalLink href="https://console.cloud.google.com/project/_/iam-admin">
                          IAM &amp; Admin Page
                        </ExternalLink>
                      ),
                    }
                  )}
                </Text>
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="prefix">
            {field => (
              <field.Layout.Stack
                label={t('Root Path')}
                hintText={t(
                  'The path at which files are located within this repository.'
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="/"
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="layoutType">
            {field => (
              <field.Layout.Stack
                label={t('Directory Layout')}
                hintText={t('The layout of the folder structure.')}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={LAYOUT_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="layoutCasing">
            {field => (
              <field.Layout.Stack
                label={t('Path Casing')}
                hintText={t('The case of files and folders.')}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={CASING_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Save changes')}</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
