import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {analytics} from 'app/utils/analytics';
import {getCurrentMember} from 'app/actionCreators/members';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import EmailField from 'app/views/settings/components/forms/emailField';
import Form from 'app/views/settings/components/forms/form';
import Panel from 'app/components/panels/panel';
import SelectField from 'app/views/settings/components/forms/selectField';
import SentryTypes from 'app/sentryTypes';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';

const recordAnalyticsUserInvited = ({organization, project}) =>
  analytics('onboarding_v2.user_invited', {
    org_id: parseInt(organization.id, 10),
    project: project.slug,
  });

class InviteMembers extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    config: SentryTypes.Config.isRequired,
    formProps: PropTypes.object,
  };

  state = {
    invitedEmails: [],
    roleList: [],
  };

  componentDidMount() {
    this.fetchRoleDetails();
  }

  async fetchRoleDetails() {
    const {api, organization} = this.props;

    const member = await getCurrentMember(api, organization.slug);

    this.setState({roleList: member.roles});
  }

  get emailSuffix() {
    return this.props.config.user.email.split('@')[1];
  }

  handleSubmitSuccess = (data, model) => {
    model.fields.set('email', '');
    this.setState(state => ({invitedEmails: [...state.invitedEmails, data.email]}));
    addSuccessMessage(t('Invited %s to your organization', data.email));

    const {organization, project} = this.props;
    recordAnalyticsUserInvited({organization, project});
  };

  render() {
    const {invitedEmails, roleList} = this.state;
    const {project, formProps, organization} = this.props;

    return (
      <React.Fragment>
        {invitedEmails.length > 0 && (
          <Alert type="success" icon="icon-user-multi">
            {tct('[emailList] has been invited to your organization.', {
              emailList: <strong>{invitedEmails.join(', ')}</strong>,
            })}
          </Alert>
        )}
        <Panel>
          <Form
            apiEndpoint={`/organizations/${organization.slug}/members/`}
            apiMethod="POST"
            submitLabel={t('Invite Member')}
            onSubmitSuccess={this.handleSubmitSuccess}
            initialData={{teams: [project.team.slug]}}
            {...formProps}
          >
            <HelpText>
              {t(
                `Enter the emails of team members you'd like in your
                 organization. We'll send out their invitation and guide your
                 teammates through this same setup.`
              )}
            </HelpText>
            <EmailField
              name="email"
              required
              placeholder={`e.g. team.member@${this.emailSuffix}`}
              label={t('Member Email')}
              help={t(
                'Enter the email of a team member to invite to your Sentry Organization. You may invite more than one.'
              )}
            />
            <SelectField
              name="role"
              label={t('Member Role')}
              required
              help={t(
                'User roles determine the permission scopes a user will have within your Sentry organization.'
              )}
              placeholder={t('Select a role')}
              choices={roleList.map(role => [
                role.id,
                <React.Fragment key={role.id}>
                  {role.name}
                  <RoleDescriptiom>{role.desc}</RoleDescriptiom>
                </React.Fragment>,
              ])}
            />
          </Form>
        </Panel>
      </React.Fragment>
    );
  }
}

const HelpText = styled(TextBlock)`
  padding: ${space(2)};
  margin: 0;
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

const RoleDescriptiom = styled('div')`
  margin-top: ${space(0.5)};
  line-height: 1.4em;
  font-size: 0.8em;
`;

export default withOrganization(withApi(withConfig(InviteMembers)));
