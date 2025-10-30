import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {OtlpTab} from 'sentry/views/settings/project/projectKeys/credentials/otlp';
import {VercelTab} from 'sentry/views/settings/project/projectKeys/credentials/vercel';

type Props = {
  data: ProjectKey;
  projectId: string;
  showDsn?: boolean;
  showDsnPublic?: boolean;
  showMinidump?: boolean;
  showOtlpLogs?: boolean;
  showOtlpTraces?: boolean;
  showProjectId?: boolean;
  showPublicKey?: boolean;
  showSecretKey?: boolean;
  showSecurityEndpoint?: boolean;
  showUnreal?: boolean;
  showVercelLogDrainEndpoint?: boolean;
};

type TabValue = 'otlp' | 'security' | 'minidump' | 'unreal' | 'vercel' | 'credentials';

interface TabConfig {
  key: TabValue;
  label: string;
  visible: boolean;
}

interface SecurityTabProps {
  securityEndpoint: string;
}

function SecurityTab({securityEndpoint}: SecurityTabProps) {
  return (
    <FieldGroup
      label={t('Security Header Endpoint')}
      help={tct('Use your security header endpoint for features like [link].', {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/security-policy-reporting/">
            {t('CSP and Expect-CT reports')}
          </ExternalLink>
        ),
      })}
      inline={false}
      flexibleControlStateSize
    >
      <TextCopyInput aria-label={t('Security Header Endpoint URL')}>
        {securityEndpoint}
      </TextCopyInput>
    </FieldGroup>
  );
}

interface MinidumpTabProps {
  minidumpEndpoint: string;
}

function MinidumpTab({minidumpEndpoint}: MinidumpTabProps) {
  return (
    <FieldGroup
      label={t('Minidump Endpoint')}
      help={tct(
        'Use this endpoint to upload [link], for example with Electron, Crashpad or Breakpad.',
        {
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/native/guides/minidumps/">
              minidump crash reports
            </ExternalLink>
          ),
        }
      )}
      inline={false}
      flexibleControlStateSize
    >
      <TextCopyInput aria-label={t('Minidump Endpoint URL')}>
        {minidumpEndpoint}
      </TextCopyInput>
    </FieldGroup>
  );
}

interface UnrealTabProps {
  unrealEndpoint: string;
}

function UnrealTab({unrealEndpoint}: UnrealTabProps) {
  return (
    <FieldGroup
      label={t('Unreal Engine Endpoint')}
      help={t('Use this endpoint to configure your UE Crash Reporter.')}
      inline={false}
      flexibleControlStateSize
    >
      <TextCopyInput aria-label={t('Unreal Engine Endpoint URL')}>
        {unrealEndpoint}
      </TextCopyInput>
    </FieldGroup>
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

function CredentialsTab({
  publicKey,
  secretKey,
  projectId,
  showPublicKey,
  showSecretKey,
  showProjectId,
}: CredentialsTabProps) {
  const fields = useMemo(() => {
    return [
      {
        label: t('Public Key'),
        value: publicKey,
        show: showPublicKey,
      },
      {
        label: t('Secret Key'),
        value: secretKey,
        show: showSecretKey,
      },
      {
        label: t('Project ID'),
        value: projectId,
        show: showProjectId,
      },
    ];
  }, [publicKey, secretKey, projectId, showPublicKey, showSecretKey, showProjectId]);
  return (
    <Fragment>
      {fields.map(
        field =>
          field.show && (
            <FieldGroup
              key={field.label}
              label={field.label}
              inline={false}
              flexibleControlStateSize
            >
              <TextCopyInput aria-label={field.label}>{field.value}</TextCopyInput>
            </FieldGroup>
          )
      )}
    </Fragment>
  );
}

function ProjectKeyCredentials({
  data,
  projectId,
  showDsn = true,
  showDsnPublic = true,
  showMinidump = true,
  showProjectId = false,
  showPublicKey = false,
  showSecretKey = false,
  showOtlpTraces = false,
  showOtlpLogs = false,
  showVercelLogDrainEndpoint = false,
  showSecurityEndpoint = true,
  showUnreal = true,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  // Calculate available tabs based on props
  const availableTabs = useMemo<TabConfig[]>(() => {
    const tabs: TabConfig[] = [
      {
        key: 'credentials',
        label: t('Credentials'),
        visible: showPublicKey && showSecretKey && showProjectId,
      },
      {
        key: 'otlp',
        label: t('OpenTelemetry (OTLP)'),
        visible: showOtlpTraces || showOtlpLogs,
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
      {
        key: 'vercel',
        label: t('Vercel Drains'),
        visible: showVercelLogDrainEndpoint || showOtlpTraces,
      },
    ];
    return tabs.filter(tab => tab.visible);
  }, [
    showOtlpTraces,
    showOtlpLogs,
    showSecurityEndpoint,
    showVercelLogDrainEndpoint,
    showMinidump,
    showUnreal,
    showPublicKey,
    showSecretKey,
    showProjectId,
  ]);

  // Get showDeprecatedDsn from query params
  const showDeprecatedDsn = decodeScalar(location?.query?.showDeprecated) === 'true';

  // Get current tab from query params, defaulting to first available
  const getCurrentTab = (): TabValue => {
    const queryTab = decodeScalar(location?.query?.tab);
    const validTabs = availableTabs.map(tab => tab.key);
    return validTabs.includes(queryTab as TabValue)
      ? (queryTab as TabValue)
      : (availableTabs[0]?.key ?? 'otlp');
  };

  const activeTab = getCurrentTab();

  const handleTabChange = (newTab: TabValue) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        tab: newTab,
      },
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'otlp':
        return (
          <OtlpTab
            logsEndpoint={data.dsn.otlp_logs}
            tracesEndpoint={data.dsn.otlp_traces}
            publicKey={data.public}
            showOtlpLogs={showOtlpLogs}
            showOtlpTraces={showOtlpTraces}
          />
        );
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
      case 'vercel':
        return (
          <VercelTab
            showVercelLogDrainEndpoint={showVercelLogDrainEndpoint}
            integrationEndpoint={data.dsn.integration}
            publicKey={data.public}
            showOtlpTraces={showOtlpTraces}
            tracesEndpoint={data.dsn.otlp_traces}
          />
        );
      default:
        return undefined;
    }
  };

  return (
    <Fragment>
      {showDsnPublic && (
        <FieldGroup
          label={t('DSN')}
          inline={false}
          flexibleControlStateSize
          help={tct('The DSN tells the SDK where to send the events to. [link]', {
            link: showDsn ? (
              <Link
                to={{
                  ...location,
                  query: {
                    ...location.query,
                    showDeprecated: showDeprecatedDsn ? undefined : 'true',
                  },
                }}
              >
                {showDeprecatedDsn ? t('Hide deprecated DSN') : t('Show deprecated DSN')}
              </Link>
            ) : null,
          })}
        >
          <TextCopyInput aria-label={t('DSN URL')}>{data.dsn.public}</TextCopyInput>
          {showDeprecatedDsn && (
            <StyledField
              label={null}
              help={t(
                'Deprecated DSN includes a secret which is no longer required by newer SDK versions. If you are unsure which to use, follow installation instructions for your language.'
              )}
              inline={false}
              flexibleControlStateSize
            >
              <TextCopyInput>{data.dsn.secret}</TextCopyInput>
            </StyledField>
          )}
        </FieldGroup>
      )}

      {!showDsnPublic && showDsn && (
        <FieldGroup
          label={t('DSN (Deprecated)')}
          help={t(
            'Deprecated DSN includes a secret which is no longer required by newer SDK versions. If you are unsure which to use, follow installation instructions for your language.'
          )}
          inline={false}
          flexibleControlStateSize
        >
          <TextCopyInput>{data.dsn.secret}</TextCopyInput>
        </FieldGroup>
      )}

      {data.useCase && (
        <FieldGroup
          label={t('Use Case')}
          help={t('Whether the DSN is for the user or for internal data submissions.')}
          inline
          flexibleControlStateSize
        >
          <StyledField label={null} inline={false} flexibleControlStateSize>
            {data.useCase}
          </StyledField>
        </FieldGroup>
      )}

      {availableTabs.length > 0 && (
        <Fragment>
          <Tabs value={activeTab} onChange={handleTabChange}>
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

const StyledField = styled(FieldGroup)`
  padding: ${p => p.theme.space['2xs']} 0 0 0;
`;

export default ProjectKeyCredentials;
