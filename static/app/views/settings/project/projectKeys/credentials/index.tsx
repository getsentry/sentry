import {Fragment, useMemo} from 'react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';
import {z} from 'zod';

import {Disclosure} from '@sentry/scraps/disclosure';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {getManagedIngestDisplayDsn} from 'sentry/utils/managedIngestDomain';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FieldList} from 'sentry/views/settings/project/projectKeys/fieldList';

type Props = {
  data: ProjectKey;
  projectId: string;
  showMinidump?: boolean;
  showProjectId?: boolean;
  showPublicKey?: boolean;
  showSecretKey?: boolean;
  showSecurityEndpoint?: boolean;
  showUnreal?: boolean;
};

type TabValue = 'security' | 'minidump' | 'unreal' | 'credentials';

interface TabConfig {
  key: TabValue;
  label: string;
  visible: boolean;
}

interface SecurityTabProps {
  securityEndpoint: string;
}

const securitySchema = z.object({
  securityEndpoint: z.string(),
});

function SecurityTab({securityEndpoint}: SecurityTabProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {securityEndpoint},
    validators: {onDynamic: securitySchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <form.AppField name="securityEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('Security Header Endpoint')}
              hintText={tct(
                'Use your security header endpoint for features like [link].',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/security-policy-reporting/">
                      {t('CSP reports')}
                    </ExternalLink>
                  ),
                }
              )}
            >
              <TextCopyInput aria-label={t('Security Header Endpoint URL')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldList>
    </form.AppForm>
  );
}

interface MinidumpTabProps {
  minidumpEndpoint: string;
}

const minidumpSchema = z.object({
  minidumpEndpoint: z.string(),
});

function MinidumpTab({minidumpEndpoint}: MinidumpTabProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {minidumpEndpoint},
    validators: {onDynamic: minidumpSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <form.AppField name="minidumpEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('Minidump Endpoint')}
              hintText={tct(
                'Use this endpoint to upload [link], for example with Electron, Crashpad or Breakpad.',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/platforms/native/guides/minidumps/">
                      minidump crash reports
                    </ExternalLink>
                  ),
                }
              )}
            >
              <TextCopyInput aria-label={t('Minidump Endpoint URL')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldList>
    </form.AppForm>
  );
}

interface UnrealTabProps {
  unrealEndpoint: string;
}

const unrealSchema = z.object({
  unrealEndpoint: z.string(),
});

function UnrealTab({unrealEndpoint}: UnrealTabProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {unrealEndpoint},
    validators: {onDynamic: unrealSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        <form.AppField name="unrealEndpoint">
          {field => (
            <field.Layout.Stack
              label={t('Unreal Engine Endpoint')}
              hintText={t('Use this endpoint to configure your UE Crash Reporter.')}
            >
              <TextCopyInput aria-label={t('Unreal Engine Endpoint URL')}>
                {field.state.value}
              </TextCopyInput>
            </field.Layout.Stack>
          )}
        </form.AppField>
      </FieldList>
    </form.AppForm>
  );
}

interface CredentialsTabProps {
  projectId: string;
  publicKey: string;
  secretKey: string;
  showProjectId: boolean;
  showPublicKey: boolean;
  showSecretKey: boolean;
}

const credentialsSchema = z.object({
  publicKey: z.string(),
  secretKey: z.string(),
  projectId: z.string(),
});

function CredentialsTab({
  publicKey,
  secretKey,
  projectId,
  showPublicKey,
  showSecretKey,
  showProjectId,
}: CredentialsTabProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {publicKey, secretKey, projectId},
    validators: {onDynamic: credentialsSchema},
  });

  return (
    <form.AppForm form={form}>
      <FieldList>
        {showPublicKey && (
          <form.AppField name="publicKey">
            {field => (
              <field.Layout.Stack label={t('Public Key')}>
                <TextCopyInput aria-label={t('Public Key')}>
                  {field.state.value}
                </TextCopyInput>
              </field.Layout.Stack>
            )}
          </form.AppField>
        )}
        {showSecretKey && (
          <form.AppField name="secretKey">
            {field => (
              <field.Layout.Stack label={t('Secret Key')}>
                <TextCopyInput aria-label={t('Secret Key')}>
                  {field.state.value}
                </TextCopyInput>
              </field.Layout.Stack>
            )}
          </form.AppField>
        )}
        {showProjectId && (
          <form.AppField name="projectId">
            {field => (
              <field.Layout.Stack label={t('Project ID')}>
                <TextCopyInput aria-label={t('Project ID')}>
                  {field.state.value}
                </TextCopyInput>
              </field.Layout.Stack>
            )}
          </form.AppField>
        )}
      </FieldList>
    </form.AppForm>
  );
}

export function ProjectKeyCredentials({
  data,
  projectId,
  showMinidump = true,
  showProjectId = false,
  showPublicKey = false,
  showSecretKey = false,
  showSecurityEndpoint = true,
  showUnreal = true,
}: Props) {
  const organization = useOrganization();
  const standardDsn = getManagedIngestDisplayDsn(data.dsn.public, organization.id);

  const availableTabs = useMemo<TabConfig[]>(() => {
    const tabs: TabConfig[] = [
      {
        key: 'credentials',
        label: t('Credentials'),
        visible: showPublicKey && showSecretKey && showProjectId,
      },
      {
        key: 'security',
        label: t('Security Header'),
        visible: showSecurityEndpoint,
      },
      {
        key: 'minidump',
        label: t('Minidump'),
        visible: showMinidump,
      },
      {
        key: 'unreal',
        label: t('Unreal Engine'),
        visible: showUnreal,
      },
    ];
    return tabs.filter(tab => tab.visible);
  }, [
    showSecurityEndpoint,
    showMinidump,
    showUnreal,
    showPublicKey,
    showSecretKey,
    showProjectId,
  ]);

  const dsnForm = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      dsn: data.managedIngest?.dsn.public ?? standardDsn,
      useCase: data.useCase ?? '',
    },
    validators: {
      onDynamic: z.object({
        dsn: z.string(),
        useCase: z.string(),
      }),
    },
  });

  const tabParser = useMemo(
    () => ({
      ...parseAsStringLiteral(availableTabs.map(tab => tab.key)),
      defaultValue: availableTabs[0]?.key ?? 'security',
    }),
    [availableTabs]
  );

  const [activeTab, setActiveTab] = useQueryState('tab', tabParser);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'security':
        return <SecurityTab securityEndpoint={data.dsn.security} />;
      case 'minidump':
        return <MinidumpTab minidumpEndpoint={data.dsn.minidump} />;
      case 'unreal':
        return <UnrealTab unrealEndpoint={data.dsn.unreal} />;
      case 'credentials':
        return (
          <CredentialsTab
            publicKey={data.public}
            secretKey={data.secret}
            projectId={projectId}
            showPublicKey={showPublicKey}
            showSecretKey={showSecretKey}
            showProjectId={showProjectId}
          />
        );
      default:
        return;
    }
  };

  return (
    <Fragment>
      <dsnForm.AppForm form={dsnForm}>
        <FieldList>
          <dsnForm.AppField name="dsn">
            {field => (
              <field.Layout.Stack
                label={t('DSN')}
                hintText={t('The DSN tells the SDK where to send events.')}
              >
                <TextCopyInput aria-label={t('DSN URL')}>
                  {field.state.value}
                </TextCopyInput>
                {data.managedIngest && (
                  <Stack gap="sm" paddingTop="2xs">
                    <Text size="sm" variant="muted">
                      {t(
                        'SDK events sent with this DSN use your custom domain, %s.',
                        data.managedIngest.hostname
                      )}
                    </Text>
                    <Disclosure size="sm">
                      <Disclosure.Title>{t('Show standard Sentry DSN')}</Disclosure.Title>
                      <Disclosure.Content>
                        <Stack gap="sm">
                          <Text size="sm" variant="muted">
                            {t(
                              'Use this DSN to send SDK events directly to Sentry instead.'
                            )}
                          </Text>
                          <TextCopyInput aria-label={t('Standard Sentry DSN')}>
                            {standardDsn}
                          </TextCopyInput>
                        </Stack>
                      </Disclosure.Content>
                    </Disclosure>
                  </Stack>
                )}
              </field.Layout.Stack>
            )}
          </dsnForm.AppField>

          {data.useCase && (
            <dsnForm.AppField name="useCase">
              {field => (
                <field.Layout.Row
                  label={t('Use Case')}
                  hintText={t(
                    'Whether the DSN is for the user or for internal data submissions.'
                  )}
                >
                  <Text>{field.state.value}</Text>
                </field.Layout.Row>
              )}
            </dsnForm.AppField>
          )}
        </FieldList>
      </dsnForm.AppForm>

      {availableTabs.length > 0 && (
        <Fragment>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <TabList>
              {availableTabs.map(tab => (
                <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
          {renderTabContent()}
        </Fragment>
      )}
    </Fragment>
  );
}
