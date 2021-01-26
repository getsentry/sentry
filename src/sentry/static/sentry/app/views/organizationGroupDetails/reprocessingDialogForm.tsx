import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import NumberField from 'app/views/settings/components/forms/numberField';
import RadioField from 'app/views/settings/components/forms/radioField';

const impacts = [
  tct(
    '[strong:Reprocessing creates new events.] This may temporarily affect event counts in both Discover and the Issue Stream.',
    {strong: <strong />}
  ),
  tct(
    '[strong:Store Native crash reports to reprocess Minidump crash reports.] Note that this requires attachment storage.',
    {strong: <strong />}
  ),
  tct(
    '[strong:Reprocessed events count towards your organization’s quota.] Rate limits and spike protection don’t apply to reprocessed events.',
    {strong: <strong />}
  ),
  t('Please wait one hour before attempting to reprocess missing debug files.'),
  t(
    'Reprocessed events will not trigger issue alerts, and reprocessed events are not subject to data forwarding.'
  ),
];

const remainingEventsChoices: [string, string][] = [
  ['keep', t('Keep')],
  ['delete', t('Delete')],
];

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'closeModal'> & {
  group: Group;
  project: Project;
  organization: Organization;
};

type State = {
  maxEvents?: number;
};

class ReprocessingDialogForm extends React.Component<Props, State> {
  state: State = {maxEvents: undefined};

  handleSuccess = () => {
    const {group, organization, closeModal} = this.props;
    const orgSlug = organization.slug;
    const hasReprocessingV2Feature = !!organization.features?.includes('reprocessing-v2');

    if (hasReprocessingV2Feature) {
      closeModal();
      window.location.reload();
      return;
    }

    browserHistory.push(
      `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${group.id}/`
    );
  };

  handleError() {
    addErrorMessage(t('Failed to reprocess. Please check your input.'));
  }

  handleMaxEventsChange = (maxEvents: string) => {
    this.setState({maxEvents: Number(maxEvents) || undefined});
  };

  render() {
    const {group, organization, Header, Body, closeModal} = this.props;
    const {maxEvents} = this.state;
    const orgSlug = organization.slug;
    const endpoint = `/organizations/${orgSlug}/issues/${group.id}/reprocessing/`;
    const title = t('Reprocess Events');

    return (
      <React.Fragment>
        <Header closeButton>{title}</Header>
        <Body>
          <Introduction>
            {t(
              'Reprocessing applies any new debug files or grouping configuration to an Issue. Before you give it a try, you should probably consider these impacts:'
            )}
          </Introduction>
          <StyledList symbol="bullet">
            {impacts.map((impact, index) => (
              <ListItem key={index}>{impact}</ListItem>
            ))}
          </StyledList>
          <Form
            submitLabel={title}
            apiEndpoint={endpoint}
            apiMethod="POST"
            initialData={{maxEvents: undefined, remainingEvents: 'keep'}}
            onSubmitSuccess={this.handleSuccess}
            onSubmitError={this.handleError}
            onCancel={closeModal}
            footerClass="modal-footer"
          >
            <NumberField
              name="maxEvents"
              label={t('Number of events to be reprocessed')}
              help={t('If you set a limit, we will reprocess your most recent events.')}
              placeholder={t('Reprocess all events')}
              onChange={this.handleMaxEventsChange}
              min={1}
            />

            <RadioField
              orientInline
              label={t('Remaining events')}
              help={t('What to do with the events that are not reprocessed.')}
              name="remainingEvents"
              choices={remainingEventsChoices}
              disabled={maxEvents === undefined}
            />
          </Form>
        </Body>
      </React.Fragment>
    );
  }
}

export default ReprocessingDialogForm;

const Introduction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledList = styled(List)`
  grid-gap: ${space(1)};
  margin-bottom: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
