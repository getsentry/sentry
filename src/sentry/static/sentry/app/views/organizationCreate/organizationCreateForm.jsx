import PropTypes from 'prop-types';
import React from 'react';

import {ApiForm, BooleanField, TextField} from '../../components/forms';
import {t, tct} from '../../locale';
import ConfigStore from '../../stores/configStore';

export default class OrganizationCreateForm extends React.Component {
  static propTypes = {
    onSubmitSuccess: PropTypes.func,
  };
  static defaultProps = {
    onSubmitSuccess: () => {},
  };

  render() {
    let termsUrl = ConfigStore.get('termsUrl');
    let privacyUrl = ConfigStore.get('privacyUrl');

    return (
      <ApiForm
        initialData={{defaultTeam: true}}
        submitLabel={t('Create Organization')}
        apiEndpoint="/organizations/"
        apiMethod="POST"
        onSubmitSuccess={this.props.onSubmitSuccess}
        requireChanges={true}
      >
        <TextField
          name="name"
          label={t('Organization Name')}
          placeholder={t('e.g. My Company')}
          required={true}
        />

        {termsUrl &&
          privacyUrl && (
            <BooleanField
              name="agreeTerms"
              label={tct(
                'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                {
                  termsLink: <a href={termsUrl} />,
                  privacyLink: <a href={privacyUrl} />,
                }
              )}
              placeholder={t('e.g. My Company')}
              required={true}
            />
          )}
      </ApiForm>
    );
  }
}
