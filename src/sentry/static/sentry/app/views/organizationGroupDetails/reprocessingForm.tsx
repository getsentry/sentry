import React from 'react';
import {browserHistory} from 'react-router';

import {Group, Organization} from 'app/types';
import {t, tct} from 'app/locale';
import {ModalRenderProps} from 'app/actionCreators/modal';
import FeatureBadge from 'app/components/featureBadge';
import Alert from 'app/components/alert';
import NumberField from 'app/components/forms/numberField';
import ApiForm from 'app/components/forms/apiForm';
import ExternalLink from 'app/components/links/externalLink';

type Props = ModalRenderProps & {
  group: Group;
  organization: Organization;
};

class ReprocessingForm extends React.Component<Props> {
  onSuccess = () => {
    const {group, organization} = this.props;
    browserHistory.push(
      `/organizations/${organization.slug}/issues/?query=tags[original_group_id]:${group.id}`
    );
  };

  getEndpoint() {
    const {group, organization} = this.props;
    return `/organizations/${organization.slug}/issues/${group.id}/reprocessing/`;
  }

  render() {
    const {Header, Body, closeModal} = this.props;

    return (
      <React.Fragment>
        <Header>
          {t('Reprocessing')}
          <FeatureBadge type="alpha" />
        </Header>
        <Body>
          <Alert type="warning">
            {t(
              'Reprocessing is a preview feature. Please carefully review the limitations and implications!'
            )}
          </Alert>

          <p>
            {t(
              'You can choose to reprocess issues to apply new debug files and updated grouping configuration. While reprocessing is in preview, keep the following limitations in mind:'
            )}
          </p>

          <ul>
            <li>
              {tct(
                'Sentry [strong:creates new events and deletes this issue.] This may temporarily affect event counts in Discover and the Issue Stream.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'Depending on the number of events, [strong:reprocessing can take several minutes.] Once started, Sentry opens a view on the Issue Stream that shows the reprocessed issues.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'To reprocess Minidump crash reports, ensure [strong:storing native crash reports is enabled.] Attachment storage is required for this.',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                "Reprocessing one or multiple events [strong:counts against your organization's quota]. Rate limits and spike protection do not apply.",
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'If you have uploaded missing debug files, [strong:please wait at least one hour before attempting to reprocess.]',
                {strong: <strong />}
              )}
            </li>
            <li>
              {tct(
                'Reprocessed events will not trigger issue alerts, and reprocessed events will not be subject to [link:data forwarding].',
                {
                  fwd: (
                    <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/data-management/data-forwarding/" />
                  ),
                }
              )}
            </li>
          </ul>

          <ApiForm
            apiEndpoint={this.getEndpoint()}
            apiMethod="POST"
            footerClass="modal-footer"
            onSubmitSuccess={this.onSuccess}
            submitLabel={t('Reprocess Issue')}
            submitLoadingMessage={t('Reprocessing\u2026')}
            submitErrorMessage={t('Failed to reprocess. Please check your input.')}
            hideErrors
            onCancel={closeModal}
          >
            <NumberField
              name="maxEvents"
              label={t('Limit Number of Events')}
              help={t(
                'Constrain reprocessing to a maximum number of events in this issue. The latest events will be reprocessed. Defaults to all events.'
              )}
              placeholder={t('All events')}
              min={1}
            />
          </ApiForm>
        </Body>
      </React.Fragment>
    );
  }
}

export default ReprocessingForm;
