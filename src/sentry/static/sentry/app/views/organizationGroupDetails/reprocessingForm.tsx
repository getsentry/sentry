import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import space from 'app/styles/space';
import {Group, Organization} from 'app/types';
import {t, tct} from 'app/locale';
import {ModalRenderProps} from 'app/actionCreators/modal';
import FeatureBadge from 'app/components/featureBadge';
import NumberField from 'app/components/forms/numberField';
import {List, ListItem} from 'app/components/list';
import Alert from 'app/components/alert';
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
            {t('This is a preview feature that’s currently under development.')}
          </Alert>
          <p>
            {t(
              'Reprocessing applies any new debug files or grouping configuration to an Issue. Before you give it a try, you should probably consider these impacts:'
            )}
          </p>

          <StyledList>
            <ListItem>
              {tct(
                '[strong:Creates new events and deletes the old issue.] This may temporarily affect event counts in both Discover and the Issue Stream.',
                {strong: <strong />}
              )}
            </ListItem>
            <ListItem>
              {tct(
                '[strong:Reprocessing may take a while.] See progress as it happens in the Issue Stream.',
                {strong: <strong />}
              )}
            </ListItem>
            <ListItem>
              {' '}
              {tct(
                '[strong:Store Native crash reports to reprocess Minidump crash reports.] Note that this requires attachment storage.',
                {strong: <strong />}
              )}
            </ListItem>
            <ListItem>
              {tct(
                '[strong:Reprocessed events count towards your organization’s quota]. Rate limits and spike protection don’t apply here.',
                {strong: <strong />}
              )}
            </ListItem>
            <ListItem>
              {tct('Wait one hour before attempting to reprocess missing debug files.', {
                strong: <strong />,
              })}
            </ListItem>
            <ListItem>
              {tct(
                'Reprocessed events will not trigger issue alerts, and reprocessed events are not subject to [link:data forwarding].',
                {
                  fwd: (
                    <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/data-management/data-forwarding/" />
                  ),
                }
              )}
            </ListItem>
          </StyledList>
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
              label={t('Select number of events to be processed')}
              help={t(
                'The default is to reprocess all events, but you can limit the number of events reprocessed in this Issue. If you set a limit, we will reprocess your most recent events.'
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

const StyledList = styled(List)`
  margin-bottom: ${space(4)};
`;

export default ReprocessingForm;
