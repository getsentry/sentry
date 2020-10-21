import { Component, Fragment } from 'react';
import styled from '@emotion/styled';

import {ProjectKey} from 'app/views/settings/project/projectKeys/types';
import {t, tct} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import Field from 'app/views/settings/components/forms/field';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

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
} & typeof DEFAULT_PROPS;

type State = {
  showDeprecatedDsn: boolean;
};

class ProjectKeyCredentials extends Component<Props, State> {
  static defaultProps = DEFAULT_PROPS;

  state = {
    showDeprecatedDsn: false,
  };

  toggleDeprecatedDsn = () => {
    this.setState(state => ({
      showDeprecatedDsn: !state.showDeprecatedDsn,
    }));
  };

  render() {
    const {showDeprecatedDsn} = this.state;
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
      <Fragment>
        {showDsnPublic && (
          <Field
            label={t('DSN')}
            inline={false}
            flexibleControlStateSize
            help={tct('The DSN tells the SDK where to send the events to. [link]', {
              link: showDsn ? (
                <Link to="" onClick={this.toggleDeprecatedDsn}>
                  {showDeprecatedDsn
                    ? t('Hide deprecated DSN')
                    : t('Show deprecated DSN')}
                </Link>
              ) : null,
            })}
          >
            <TextCopyInput>
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
          </Field>
        )}

        {/* this edge case should imho not happen, but just to be sure */}
        {!showDsnPublic && showDsn && (
          <Field
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
      </Fragment>
    );
  }
}

const StyledField = styled(Field)`
  padding: ${space(0.5)} 0 0 0;
`;

export default ProjectKeyCredentials;
