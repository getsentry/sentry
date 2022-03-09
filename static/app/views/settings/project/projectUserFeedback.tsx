import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import formGroups from 'sentry/data/forms/userFeedback';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type RouteParams = {
  orgId: string;
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}>;

class ProjectUserFeedbackSettings extends AsyncView<Props> {
  componentDidMount() {
    window.sentryEmbedCallback = function (embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function (_body) {
        this._submitInProgress = true;
        setTimeout(() => {
          this._submitInProgress = false;
          this.onSuccess();
        }, 500);
      };
    };
  }

  componentWillUnmount() {
    window.sentryEmbedCallback = null;
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;
    return [
      ['keyList', `/projects/${orgId}/${projectId}/keys/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
  }

  getTitle(): string {
    const {projectId} = this.props.params;
    return routeTitleGen(t('User Feedback'), projectId, false);
  }

  handleClick = () => {
    Sentry.showReportDialog({
      // should never make it to the Sentry API, but just in case, use throwaway id
      eventId: '00000000000000000000000000000000',
    });
  };

  renderBody() {
    const {orgId, projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader title={t('User Feedback')} />
        <TextBlock>
          {t(
            `Don't rely on stack traces and graphs alone to understand
            the cause and impact of errors. Enable User Feedback to collect
            your users' comments when they encounter a crash or bug.`
          )}
        </TextBlock>
        <TextBlock>
          {t(
            `When configured, your users will be presented with a dialog prompting
            them for additional information. That information will get attached to
            the issue in Sentry.`
          )}
        </TextBlock>
        <ButtonList>
          <Button external href="https://docs.sentry.io/product/user-feedback/">
            {t('Read the docs')}
          </Button>
          <Button priority="primary" onClick={this.handleClick}>
            {t('Open the report dialog')}
          </Button>
        </ButtonList>

        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/projects/${orgId}/${projectId}/`}
          initialData={this.state.project.options}
        >
          <Access access={['project:write']}>
            {({hasAccess}) => <JsonForm disabled={!hasAccess} forms={formGroups} />}
          </Access>
        </Form>
      </div>
    );
  }
}

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

export default ProjectUserFeedbackSettings;
