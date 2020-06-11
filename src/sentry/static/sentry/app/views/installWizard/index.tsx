import React from 'react';
import DocumentTitle from 'react-document-title';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {ApiForm} from 'app/components/forms';
import {getOptionDefault, getOptionField, getForm} from 'app/options';
import sentryPattern from 'app/../images/pattern/sentry-pattern.png';
import space from 'app/styles/space';
import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';

type Props = {
  onConfigured: () => void;
} & AsyncView['props'];

type State = {} & AsyncView['state'];

export default class InstallWizard extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['data', '/internal/options/?query=is:required']];
  }

  renderFormFields() {
    const options = this.state.data;

    let missingOptions = new Set(
      Object.keys(options).filter(option => !options[option].field.isSet)
    );
    // This is to handle the initial installation case.
    // Even if all options are filled out, we want to prompt to confirm
    // them. This is a bit of a hack because we're assuming that
    // the backend only spit back all filled out options for
    // this case.
    if (missingOptions.size === 0) {
      missingOptions = new Set(Object.keys(options));
    }

    // A mapping of option name to Field object
    const fields = {};

    for (const key of missingOptions) {
      const option = options[key];
      if (option.field.disabled) {
        continue;
      }
      fields[key] = getOptionField(key, option.field);
    }

    return getForm(fields);
  }

  getInitialData() {
    const options = this.state.data;
    const data = {};
    Object.keys(options).forEach(optionName => {
      const option = options[optionName];
      if (option.field.disabled) {
        return;
      }

      // TODO(dcramer): we need to rethink this logic as doing multiple "is this value actually set"
      // is problematic
      // all values to their server-defaults (as client-side defaults dont really work)
      const displayValue = option.value || getOptionDefault(optionName);
      if (
        // XXX(dcramer): we need the user to explicitly choose beacon.anonymous
        // vs using an implied default so effectively this is binding
        optionName !== 'beacon.anonymous' &&
        // XXX(byk): if we don't have a set value but have a default value filled
        // instead, from the client, set it on the data so it is sent to the server
        !option.field.isSet &&
        displayValue !== undefined
      ) {
        data[optionName] = displayValue;
      }
    });
    return data;
  }

  getTitle() {
    return t('Setup Sentry');
  }

  render() {
    const version = ConfigStore.get('version');
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <Pattern />
          <SetupWizard>
            <Heading>
              <span>{t('Welcome to Sentry')}</span>
              <Version>{version.current}</Version>
            </Heading>
            {this.state.loading
              ? this.renderLoading()
              : this.state.error
              ? this.renderError()
              : this.renderBody()}
          </SetupWizard>
        </div>
      </DocumentTitle>
    );
  }

  renderError() {
    return (
      <Alert type="error" icon={<IconWarning />}>
        {t(
          'We were unable to load the required configuration from the Sentry server. Please take a look at the service logs.'
        )}
      </Alert>
    );
  }

  renderBody() {
    return (
      <ApiForm
        apiMethod="PUT"
        apiEndpoint={this.getEndpoints()[0][1]}
        submitLabel={t('Continue')}
        initialData={this.getInitialData()}
        onSubmitSuccess={this.props.onConfigured}
      >
        <p>{t('Complete setup by filling out the required configuration.')}</p>

        {this.renderFormFields()}
      </ApiForm>
    );
  }
}

const fixedStyle = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Pattern = styled('div')`
  &::before {
    ${fixedStyle}
    content: '';
    background-image: linear-gradient(to right, #9f73c3 0%, #6875be 100%);
    background-repeat: repeat-y;
  }

  &::after {
    ${fixedStyle}
    content: '';
    background: url(${sentryPattern});
    background-size: 400px;
    opacity: 0.8;
  }
`;

const Heading = styled('h1')`
  display: grid;
  grid-gap: ${space(1)};
  justify-content: space-between;
  grid-auto-flow: column;
  line-height: 36px;
`;

const Version = styled('small')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: inherit;
`;

const SetupWizard = styled('div')`
  background: #fff;
  width: 600px;
  padding: 40px 40px 20px;
  border-radius: 4px;
  box-shadow: 0 5px 30px rgba(0, 0, 0, 0.3);
  position: absolute;
  top: 50px;
  left: 50%;
  margin-left: -300px;
  margin-bottom: 50px;
`;
