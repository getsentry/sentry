import React from 'react';

import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {t, tct} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import getDynamicText from 'app/utils/getDynamicText';

const DEFAULT_PROPS = {
  showDsn: true,
  showDsnPublic: true,
  showSecurityEndpoint: true,
  showMinidump: true,
  showUnreal: true,
  showPublicKey: false,
  showSecretKey: false,
  showProjectId: false,
};

type Props = {
  projectId: string;
  data: ProjectKey;
} & Partial<typeof DEFAULT_PROPS>;

class ProjectKeyCredentials extends React.Component<Props> {
  static defaultProps = DEFAULT_PROPS;

  render() {
    const {
      projectId,
      data,
      showDsn,
      showDsnPublic,
      showSecurityEndpoint,
      showMinidump,
      showUnreal,
      showPublicKey,
      showSecretKey,
      showProjectId,
    } = this.props;

    return (
      <React.Fragment>
        {showDsnPublic && (
          <Field label={t('DSN')} inline={false} flexibleControlStateSize>
            <TextCopyInput>
              {getDynamicText({
                value: data.dsn.public,
                fixed: '__DSN__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showDsn && (
          <Field
            label={t('DSN (Deprecated)')}
            help={t(
              "This DSN includes the secret which is no longer required by Sentry' newer versions of SDKs. If you are unsure which to use, follow installation instructions for your language."
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
          </Field>
        )}

        {showSecurityEndpoint && (
          <Field
            label={t('Security Header Endpoint')}
            help={t(
              'Use your security header endpoint for features like CSP and Expect-CT reports.'
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput>
              {getDynamicText({
                value: data.dsn.security,
                fixed: '__SECURITY_HEADER_ENDPOINT__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showMinidump && (
          <Field
            label={t('Minidump Endpoint')}
            help={tct(
              'Use this endpoint to upload [link], for example with Electron, Crashpad or Breakpad.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/clients/minidump/">
                    minidump crash reports
                  </ExternalLink>
                ),
              }
            )}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput>
              {getDynamicText({
                value: data.dsn.minidump,
                fixed: '__MINIDUMP_ENDPOINT__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showUnreal && (
          <Field
            label={t('Unreal Engine 4 Endpoint')}
            help={t('Use this endpoint to configure your UE4 Crash Reporter.')}
            inline={false}
            flexibleControlStateSize
          >
            <TextCopyInput>
              {getDynamicText({
                value: data.dsn.unreal || '',
                fixed: '__UNREAL_ENDPOINT__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showPublicKey && (
          <Field label={t('Public Key')} inline flexibleControlStateSize>
            <TextCopyInput>
              {getDynamicText({
                value: data.public,
                fixed: '__PUBLICKEY__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showSecretKey && (
          <Field label={t('Secret Key')} inline flexibleControlStateSize>
            <TextCopyInput>
              {getDynamicText({
                value: data.secret,
                fixed: '__SECRETKEY__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showProjectId && (
          <Field label={t('Project ID')} inline flexibleControlStateSize>
            <TextCopyInput>
              {getDynamicText({
                value: projectId,
                fixed: '__PROJECTID__',
              })}
            </TextCopyInput>
          </Field>
        )}
      </React.Fragment>
    );
  }
}
export default ProjectKeyCredentials;
