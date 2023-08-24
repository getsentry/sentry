import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {IconArrow, IconSound} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Organization, Project} from 'sentry/types';
import {logException} from 'sentry/utils/logging';
import useApi from 'sentry/utils/useApi';
import {
  ActionText,
  ActionTextContainer,
  ActionTitle,
} from 'sentry/views/alerts/blueprints/procedures/summary';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';
import {getActionIcon} from 'sentry/views/alerts/blueprints/util';
import {TextAction} from 'sentry/views/alerts/rules/issue/details/textRule';

type AlertProcedureTriggerModalProps = {
  group: Group;
  organization: Organization;
  procedures: AlertProcedure[];
  project: Project;
  event?: Event;
} & ModalRenderProps;

function AlertProcedureTriggerModal({
  event,
  organization,
  procedures,
  project,
  Header,
  Body,
  Footer,
  closeModal,
}: AlertProcedureTriggerModalProps) {
  const api = useApi();
  const [procedure, setProcedure] = useState(procedures[0]);

  async function handleSubmit() {
    const path = `/organizations/${organization.slug}/alert-procedures/${procedure.id}/trigger/`;
    try {
      await api.requestPromise(path, {
        method: 'POST',
        data: {
          project: project.id,
          event: event?.id,
        },
      });
      addSuccessMessage(t('Procedure successfully ran'));
      closeModal();
    } catch (err) {
      logException(err);
      addErrorMessage(t('Unable to run procedure'));
      // eslint-disable-next-line no-alert
      alert(JSON.stringify(err.responseJSON));
    }
  }

  const actions = procedure?.issue_alert_actions ?? [];
  const procedureOptions = procedures.map(p => ({value: p.id, label: p.label}));

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Run Procedure')}</h4>
      </Header>
      <Body>
        <ProcedureHeading>
          <SelectControl
            name="procedure"
            onChange={opt => {
              const selectedProcedure = procedures.find(p => p.id === opt.value);
              if (selectedProcedure) {
                setProcedure(selectedProcedure);
              }
            }}
            options={procedureOptions}
            value={procedure.id}
            disabled={false}
          />
          {procedure.description && (
            <ProcedureDescription>{procedure.description}</ProcedureDescription>
          )}
        </ProcedureHeading>
        <ActionTitle>
          <IconSound size="sm" color="gray300" />
          <IconArrow direction="right" size="xs" />
          {actions.map((a, i) => {
            return i !== actions.length - 1 ? (
              <Fragment>
                {getActionIcon(a)}
                <IconArrow direction="right" size="xs" />
              </Fragment>
            ) : (
              getActionIcon(a)
            );
          })}
        </ActionTitle>
        <ActionTextContainer>
          {actions.map((a, i) => (
            <ActionText key={i}>
              {getActionIcon(a)}
              <TextAction action={a} memberList={[]} teams={[]} />
            </ActionText>
          ))}
        </ActionTextContainer>
      </Body>
      <Footer>
        <Button priority="primary" onClick={handleSubmit}>
          {t('Confirm Run')}
        </Button>
      </Footer>
    </Fragment>
  );
}
const ProcedureHeading = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
`;
const ProcedureDescription = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.4;
  margin-top: ${space(0.75)};
`;

export default AlertProcedureTriggerModal;
