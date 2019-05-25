import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import formGroups from 'app/data/forms/userFeedback';

class ProjectUserFeedbackSettings extends AsyncView {
  static propTypes = {
    setProjectNavSection: PropTypes.func,
  };

  componentWillMount() {
    super.componentWillMount();
    this.props.setProjectNavSection('settings');
  }

  componentDidMount() {
    window.sentryEmbedCallback = function(embed) {
      // Mock the embed's submit xhr to always be successful
      // NOTE: this will not have errors if the form is empty
      embed.submit = function(body) {
        this._submitInProgress = true;
        setTimeout(
          function() {
            this._submitInProgress = false;
            this.onSuccess();
          }.bind(this),
          500
        );
      };
    };
  }

  componentWillUnmount() {
    window.sentryEmbedCallback = null;
  }

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    return [
      ['keyList', `/projects/${orgId}/${projectId}/keys/`],
      ['project', `/projects/${orgId}/${projectId}/`],
    ];
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
            'Enabling User Feedback allows you to interact with your users on an unprecedented level. Collect additional details about issues affecting them, and more importantly reach out to them with resolutions.'
          )}
        </TextBlock>
        <TextBlock>
          {t(
            'When configured, your users will be presented with a dialog prompting them for additional information. That information will get attached to the issue in Sentry.'
          )}
        </TextBlock>
        <TextBlock>
          {tct(
            'A detailed guide how to integrate it with our different SDKs can be found in [link].',
            {
              link: (
                <a href="https://docs.sentry.io/enriching-error-data/user-feedback/">
                  our docs
                </a>
              ),
            }
          )}
        </TextBlock>
        <TextBlock>
          <Button priority="primary" onClick={this.handleClick}>
            {t('See the report dialog in action')}
          </Button>
        </TextBlock>

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

export default ProjectUserFeedbackSettings;
