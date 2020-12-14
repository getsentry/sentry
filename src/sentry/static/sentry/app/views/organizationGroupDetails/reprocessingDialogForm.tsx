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
import {Group, Organization, Project} from 'app/types';

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
  project: Project;
  orgSlug: Organization['slug'];
};

function ReprocessingDialogForm({
  orgSlug,
  group,
  project,
  Header,
  Body,
  closeModal,
}: Props) {
  const endpoint = `/organizations/${orgSlug}/issues/${group.id}/reprocessing/`;
  const title = t('Reprocess Events');

  function handleSuccess() {
    const hasReprocessingV2Feature = !!project.features?.includes('reprocessing-v2');

    if (hasReprocessingV2Feature) {
      closeModal();
      window.location.reload();
      return;
    }

    browserHistory.push(
      `/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${group.id}/`
    );
  }

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
          onSubmitSuccess={handleSuccess}
          submitLabel={title}
          submitLoadingMessage={t('Reprocessing\u2026')}
          submitErrorMessage={t('Failed to reprocess. Please check your input.')}
          onCancel={closeModal}
        >
          <NumberField
            name="maxEvents"
            label={t('Enter the number of events to be reprocessed')}
            help={t(
              'You can limit the number of events reprocessed in this Issue. If you set a limit, we will reprocess your most recent events.'
            )}
            placeholder={t('Reprocess all events')}
            min={1}
          />
        </ApiForm>
      </Body>
    </React.Fragment>
  );
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
