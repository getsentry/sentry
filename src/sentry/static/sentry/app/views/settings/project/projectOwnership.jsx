import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {MentionsInput, Mention} from 'react-mentions';
import mentionsStyle from '../../../../styles/mentions-styles';

// import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {t, tct} from '../../../locale';
import AsyncView from '../../asyncView';
// import AutoSelectText from '../../../components/autoSelectText';
// import Button from '../../../components/buttons/button';
// import Confirm from '../../../components/confirm';
// import Field from '../components/forms/field';
// import LoadingIndicator from '../../../components/loadingIndicator';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import SentryTypes from '../../../proptypes';
import SettingsPageHeader from '../components/settingsPageHeader';
import TextBlock from '../components/text/textBlock';
import ExternalLink from '../../../components/externalLink';
import Form from '../components/forms/form';
import JsonForm from '../components/forms/jsonForm';

const CodeBlock = styled.pre`
  word-break: break-all;
  white-space: pre-wrap;
`;
const TextBlockNoMargin = styled(TextBlock)`
  margin-bottom: 0;
`;

class ProjectOwnership extends AsyncView {
  static propTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  getTitle() {
    return 'Ownership';
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return ['project', `/projects/${orgId}/${projectId}/`];
  }

  renderBody() {
    let {organization, project} = this.props;

    return (
      <div>
        <SettingsPageHeader title={t('Issue Ownership')} />

        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>

        <TextBlock>
          {tct(
            `[link:Content Security Policy]
          (CSP) is a security standard which helps prevent cross-site scripting (XSS),
          clickjacking and other code injection attacks resulting from execution of
          malicious content in the trusted web page context. It's enforced by browser
          vendors, and Sentry supports capturing CSP violations using the standard
          reporting hooks.`,
            {
              link: (
                <ExternalLink href="https://en.wikipedia.org/wiki/Content_Security_Policy" />
              ),
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>

          <PanelBody disablePadding={false}>
            <TextBlock>
              {tct(
                `To configure [csp:CSP] reports
              in Sentry, you'll need to send a header from your server describing your
              policy, as well specifying the authenticated Sentry endpoint.`,
                {
                  csp: <acronym title="Content Security Policy" />,
                }
              )}
            </TextBlock>

            <MentionsInput
              style={mentionsStyle}
              placeholder={'...'}
              onChange={this.onChange}
              onBlur={this.onBlur}
              onKeyDown={this.onKeyDown}
              value={'value'}
              required={true}
              autoFocus={true}
              displayTransform={(id, display, type) =>
                `${type === 'member' ? '@' : '#'}${display}`}
              markup="**[sentry.strip:__type__]__display__**"
            >
              <Mention
                type="member"
                trigger="@"
                data={mentionableUsers}
                onAdd={this.onAddMember}
                appendSpaceOnAdd={true}
              />
              <Mention
                type="team"
                trigger="#"
                data={mentionableTeams}
                onAdd={this.onAddTeam}
                appendSpaceOnAdd={true}
              />
            </MentionsInput>

            <TextBlockNoMargin>
              {t(`Alternatively you can setup CSP reports to simply send reports rather than
              actually enforcing the policy`)}
            </TextBlockNoMargin>
            <CodeBlock>{'??'}</CodeBlock>
          </PanelBody>
        </Panel>

        <Form
          apiMethod="POST"
          onFieldChange={() => {}}
          apiEndpoint={`/projects/${organization.id}/${project.id}/settings/`}
          onSubmit={() => {}}
          initialData={{}}
          hideFooter
        >
          <JsonForm
            {...this.props}
            forms={[
              {
                title: 'Default Ownership',
                fields: [
                  {
                    name: 'clock24Hours',
                    type: 'boolean',
                    label: 'Default Owner is everyone',
                    getData: data => ({options: data}),
                  },
                ],
              },
            ]}
          />
        </Form>
      </div>
    );
  }
}

export default ProjectOwnership;
