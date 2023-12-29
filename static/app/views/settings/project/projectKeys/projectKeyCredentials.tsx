import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProjectKey} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  data: ProjectKey;
  projectId: string;
  showDsn?: boolean;
  showDsnPublic?: boolean;
  showMinidump?: boolean;
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
          <TextCopyInput aria-label={t('DSN URL')}>
            {getDynamicText({
              value: data.dsn.public,
              fixed: '__DSN__',
            })}
          </TextCopyInput>
          {showDeprecatedDsn && (
            <StyledField
              label={null}
              help={t(
                'Deprecated DSN includes a secret which is no longer required by newer SDK versions. If you are unsure which to use, follow installation instructions for your language.'
              )}
              inline={false}
              flexibleControlStateSize
            >
              <TextCopyInput>
                {getDynamicText({
                  value: data.dsn.secret,
                  fixed: '__DSN_DEPRECATED__',
                })}
              </TextCopyInput>
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
          <TextCopyInput>
            {getDynamicText({
              value: data.dsn.secret,
              fixed: '__DSN_DEPRECATED__',
            })}
          </TextCopyInput>
        </FieldGroup>
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
            {getDynamicText({
              value: data.dsn.security,
              fixed: '__SECURITY_HEADER_ENDPOINT__',
            })}
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
            {getDynamicText({
              value: data.dsn.minidump,
              fixed: '__MINIDUMP_ENDPOINT__',
            })}
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
            {getDynamicText({
              value: data.dsn.unreal || '',
              fixed: '__UNREAL_ENDPOINT__',
            })}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showPublicKey && (
        <FieldGroup label={t('Public Key')} inline flexibleControlStateSize>
          <TextCopyInput>
            {getDynamicText({
              value: data.public,
              fixed: '__PUBLICKEY__',
            })}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showSecretKey && (
        <FieldGroup label={t('Secret Key')} inline flexibleControlStateSize>
          <TextCopyInput>
            {getDynamicText({
              value: data.secret,
              fixed: '__SECRETKEY__',
            })}
          </TextCopyInput>
        </FieldGroup>
      )}

      {showProjectId && (
        <FieldGroup label={t('Project ID')} inline flexibleControlStateSize>
          <TextCopyInput>
            {getDynamicText({
              value: projectId,
              fixed: '__PROJECTID__',
            })}
          </TextCopyInput>
        </FieldGroup>
      )}
    </Fragment>
  );
}

const StyledField = styled(FieldGroup)`
  padding: ${space(0.5)} 0 0 0;
`;

export default ProjectKeyCredentials;
