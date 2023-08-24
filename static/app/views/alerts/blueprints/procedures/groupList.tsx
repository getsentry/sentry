import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {IntegrationLink} from 'sentry/components/issueSyncListElement';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconSound} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {Event, Group, Project} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import AlertProcedureTriggerModal from 'sentry/views/alerts/blueprints/procedures/triggerModal';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';

interface AlertProcedureGroupListProps {
  group: Group;
  project: Project;
  event?: Event;
}

function AlertProcedureGroupList({event, group, project}: AlertProcedureGroupListProps) {
  const organization = useOrganization();
  const {data: procedures = [], isLoading} = useApiQuery<AlertProcedure[]>(
    [`/organizations/${organization.slug}/alert-procedures/`],
    {staleTime: 0}
  );

  function handleClick() {
    openModal(
      deps => (
        <AlertProcedureTriggerModal
          {...deps}
          event={event}
          group={group}
          project={project}
          organization={organization}
          procedures={procedures}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }
  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {t('Run Procedures')}
        <QuestionTooltip
          title={t('Trigger pre-defined actions to notify your team immediately.')}
          size="xs"
        />
      </SidebarSection.Title>
      <SidebarSection.Content>
        {isLoading ? (
          <Placeholder height="30px" />
        ) : (
          <ProcedureSidebarItem>
            <LabelWrapper>
              <IconSound size="md" />
              <IntegrationLink onClick={handleClick}>
                {tn(
                  '%s procedure available',
                  '%s procedures available',
                  procedures.length
                )}
              </IntegrationLink>
            </LabelWrapper>
          </ProcedureSidebarItem>
        )}
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
const ProcedureSidebarItem = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;
const LabelWrapper = styled('div')`
  flex: 1;
  display: flex;
  align-items: center;
`;

export default AlertProcedureGroupList;
