import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../../../../locale';
import Field from '../../components/forms/field';
import TextCopyInput from '../../components/forms/textCopyInput';
import getDynamicText from '../../../../utils/getDynamicText';

class ProjectKeyCredentials extends React.Component {
  static propTypes = {
    projectId: PropTypes.string.isRequired,
    dsn: PropTypes.object.isRequired,
    features: PropTypes.object,

    showDsn: PropTypes.bool,
    showDsnPublic: PropTypes.bool,
    showCspEndpoint: PropTypes.bool,
    showMinidump: PropTypes.bool,
    showPublicKey: PropTypes.bool,
    showSecretKey: PropTypes.bool,
    showProjectId: PropTypes.bool,
  };

  static defaultProps = {
    showDsn: true,
    showDsnPublic: true,
    showCspEndpoint: true,
    showMinidump: true,
    showPublicKey: false,
    showSecretKey: false,
    showProjectId: false,
  };

  render() {
    let {
      features,
      projectId,
      dsn,
      showDsn,
      showDsnPublic,
      showCspEndpoint,
      showMinidump,
      showPublicKey,
      showSecretKey,
      showProjectId,
    } = this.props;

    return (
      <React.Fragment>
        {showDsn && (
          <Field label={t('DSN')} inline={false} hideControlState>
            <TextCopyInput>
              {getDynamicText({
                value: dsn.secret,
                fixed: dsn.secret.replace(
                  new RegExp(`\/${projectId}$`),
                  '/<<projectId>>'
                ),
              })}
            </TextCopyInput>
          </Field>
        )}

        {showDsnPublic && (
          <Field
            label={t('DSN (Public)')}
            help={tct('Use your public DSN with browser-based SDKs such as [raven-js].', {
              'raven-js': <a href="https://github.com/getsentry/raven-js">raven-js</a>,
            })}
            inline={false}
            hideControlState
          >
            <TextCopyInput>
              {getDynamicText({
                value: dsn.public,
                fixed: dsn.public.replace(
                  new RegExp(`\/${projectId}$`),
                  '/<<projectId>>'
                ),
              })}
            </TextCopyInput>
          </Field>
        )}

        {showCspEndpoint && (
          <Field
            label={t('CSP Endpoint')}
            help={tct(
              'Use your CSP endpoint in the [directive] directive in your [header] header.',
              {
                directive: <code>report-uri</code>,
                header: <code>Content-Security-Policy</code>,
              }
            )}
            inline={false}
            hideControlState
          >
            <TextCopyInput>
              {getDynamicText({
                value: dsn.csp,
                fixed: dsn.csp.replace(new RegExp(`\/${projectId}$`), '/<<projectId>>'),
              })}
            </TextCopyInput>
          </Field>
        )}

        {showMinidump &&
          features.has('minidump') && (
            <Field
              label={t('Minidump Endpoint')}
              help={tct(
                'Use this endpoint to upload minidump crash reports, for example with Electron, Crashpad or Breakpad.',
                {
                  /* TODO: add a link to minidump docs */
                }
              )}
              inline={false}
              hideControlState
            >
              <TextCopyInput>
                {getDynamicText({
                  value: dsn.minidump,
                  fixed: dsn.minidump.replace(
                    new RegExp(`\/${projectId}$`),
                    '/<<projectId>>'
                  ),
                })}
              </TextCopyInput>
            </Field>
          )}

        {showPublicKey && (
          <Field label={t('Public Key')} inline={true} hideControlState>
            <TextCopyInput>
              {getDynamicText({
                value: dsn.public,
                fixed: '__PUBLICKEY__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showSecretKey && (
          <Field label={t('Secret Key')} inline={true} hideControlState>
            <TextCopyInput>
              {getDynamicText({
                value: dsn.secret,
                fixed: '__SECRETKEY__',
              })}
            </TextCopyInput>
          </Field>
        )}

        {showProjectId && (
          <Field label={t('Project ID')} inline={true} hideControlState>
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
