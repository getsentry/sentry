import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ExternalLink, Link} from 'sentry/components/core/link';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ProjectKey} from 'sentry/types/project';

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
};

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
  showSecurityEndpoint = true,
  showUnreal = true,
}: Props) {
  const [showDeprecatedDsn, setShowDeprecatedDsn] = useState(false);

  return (
    <Fragment>
      {showDsnPublic && (
        <FieldGroup
          label={t('DSN')}
          inline={false}
          flexibleControlStateSize
          help={tct('The DSN tells the SDK where to send the events to. [link]', {
            link: showDsn ? (
              <Link to="" onClick={() => setShowDeprecatedDsn(curr => !curr)}>
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

      {/* this edge case should imho not happen, but just to be sure */}
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

      {showOtlpLogs && (
        <Fragment>
          <FieldGroup
            label={t('OTLP Logs Endpoint')}
            help={tct(
              `Set this URL as your OTLP exporter's log endpoint. [link:Learn more]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-logs" />
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Logs Endpoint')}>
              {data.dsn.otlp_logs}
            </TextCopyInput>
          </FieldGroup>

          <FieldGroup
            label={t('OTLP Logs Endpoint Headers')}
            help={t(`Set these security headers when configuring your OTLP exporter.`)}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Logs Endpoint Headers')}>
              {`x-sentry-auth=sentry sentry_key=${data.public}`}
            </TextCopyInput>
          </FieldGroup>
        </Fragment>
      )}

      {showOtlpTraces && (
        <Fragment>
          <FieldGroup
            label={t('OTLP Traces Endpoint')}
            help={tct(
              `Set this URL as your OTLP exporter's trace endpoint. [link:Learn more]`,
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/otlp/#opentelemetry-traces" />
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Traces Endpoint')}>
              {data.dsn.otlp_traces}
            </TextCopyInput>
          </FieldGroup>

          <FieldGroup
            label={t('OTLP Traces Endpoint Headers')}
            help={t(`Set these security headers when configuring your OTLP exporter.`)}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput aria-label={t('OTLP Traces Endpoint Headers')}>
              {`x-sentry-auth=sentry sentry_key=${data.public}`}
            </TextCopyInput>
          </FieldGroup>
        </Fragment>
      )}

      {showSecurityEndpoint && (
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
            {data.dsn.security}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showMinidump && (
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
            {data.dsn.minidump}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showUnreal && (
        <FieldGroup
          label={t('Unreal Engine Endpoint')}
          help={t('Use this endpoint to configure your UE Crash Reporter.')}
          inline={false}
          flexibleControlStateSize
        >
          <TextCopyInput aria-label={t('Unreal Engine Endpoint URL')}>
            {data.dsn.unreal || ''}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showPublicKey && (
        <FieldGroup label={t('Public Key')} inline flexibleControlStateSize>
          <TextCopyInput>{data.public}</TextCopyInput>
        </FieldGroup>
      )}

      {showSecretKey && (
        <FieldGroup label={t('Secret Key')} inline flexibleControlStateSize>
          <TextCopyInput>{data.secret}</TextCopyInput>
        </FieldGroup>
      )}

      {showProjectId && (
        <FieldGroup label={t('Project ID')} inline flexibleControlStateSize>
          <TextCopyInput>{projectId}</TextCopyInput>
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
    </Fragment>
  );
}

const StyledField = styled(FieldGroup)`
  padding: ${space(0.5)} 0 0 0;
`;

export default ProjectKeyCredentials;
