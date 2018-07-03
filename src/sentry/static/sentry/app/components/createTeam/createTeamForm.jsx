import PropTypes from 'prop-types';
import React from 'react';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import SentryTypes from 'app/proptypes';
import TextField from 'app/views/settings/components/forms/textField';

export default class CreateTeamForm extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    onSuccess: PropTypes.func.isRequired,
    onSubmit: PropTypes.func,
  };

  handleCreateTeamSuccess = data => {
    addSuccessMessage(tct('Added team [team]', {team: `#${data.slug}`}));
    this.props.onSuccess(data);
  };

  render() {
    let {organization} = this.props;

    return (
      <React.Fragment>
        <p>
          {t(
            "Teams group members' access to a specific focus, e.g. a major product or application that may have sub-projects."
          )}
        </p>

        <Form
          submitLabel={t('Create Team')}
          apiEndpoint={`/organizations/${organization.slug}/teams/`}
          apiMethod="POST"
          onSubmit={this.props.onSubmit}
          onSubmitSuccess={this.handleCreateTeamSuccess}
          requireChanges
        >
          <TextField
            name="slug"
            label={t('Team Slug')}
            placeholder={t('e.g. operations, web-frontend, desktop')}
            help={t('May contain lowercase letters, numbers, dashes and underscores.')}
            required
            flexibleControlStateSize
            inline={false}
            p={0}
          />
        </Form>
      </React.Fragment>
    );
  }
}
