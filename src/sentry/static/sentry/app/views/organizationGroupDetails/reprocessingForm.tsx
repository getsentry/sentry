import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import ApiForm from 'app/components/forms/apiForm';
import NumberField from 'app/components/forms/numberField';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization} from 'app/types';

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

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'closeModal'> & {
  group: Group;
  orgSlug: Organization['slug'];
};

type State = {
  isFormInvalid: boolean;
};

class ReprocessingForm extends React.Component<Props, State> {
  state: State = {
    isFormInvalid: true,
  };

  handleSuccess = () => {
    const {orgSlug, group} = this.props;
    browserHistory.push(
      `/organizations/${orgSlug}/issues/?query=tags[original_group_id]:${group.id}`
    );
  };

  handleChangeMaxEvents(maxEvents: number) {
    this.setState({isFormInvalid: maxEvents < 1});
  }

  render() {
    const {isFormInvalid} = this.state;
    const {Header, Body, closeModal, orgSlug, group} = this.props;
    const title = t('Reprocess Events');
    const endpoint = `/organizations/${orgSlug}/issues/${group.id}/reprocessing/`;
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
          <ApiForm
            apiEndpoint={endpoint}
            apiMethod="POST"
            footerClass="modal-footer"
            onSubmitSuccess={this.handleSuccess}
            submitDisabled={isFormInvalid}
            submitLabel={title}
            submitLoadingMessage={t('Reprocessing\u2026')}
            submitErrorMessage={t('Failed to reprocess. Please check your input.')}
            onCancel={closeModal}
            initialData={{maxEvents: ''}}
            requireChanges
          >
            <NumberField
              name="maxEvents"
              label={t('Enter the number of events to be reprocessed')}
              help={t(
                'You can limit the number of events reprocessed in this Issue. If you set a limit, we will reprocess your most recent events.'
              )}
              placeholder={t('Reprocess all events')}
              onChange={value => this.handleChangeMaxEvents(Number(value))}
              min={1}
              required
            />
          </ApiForm>
        </Body>
      </React.Fragment>
    );
  }
}

export default ReprocessingForm;

const Introduction = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledList = styled(List)`
  grid-gap: ${space(1)};
  margin-bottom: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;
