import {useEffect} from 'react';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {getOwnerList} from 'sentry/components/group/assignedTo';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useCommitters from 'sentry/utils/useCommitters';
import {useIssueEventOwners} from 'sentry/utils/useIssueEventOwners';
import useOrganization from 'sentry/utils/useOrganization';

interface GroupHeaderAssigneeSelectorProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export function GroupHeaderAssigneeSelector({
  group,
  project,
  event,
}: GroupHeaderAssigneeSelectorProps) {
  const api = useApi();
  const organization = useOrganization();
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });
  const {data: eventOwners} = useIssueEventOwners({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
  });
  const {data: committersResponse} = useCommitters({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
    group,
  });

  useEffect(() => {
    // TODO: We should check if this is already loaded
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  const owners = getOwnerList(
    committersResponse?.committers ?? [],
    eventOwners,
    group.assignedTo
  );

  return (
    <AssigneeSelector
      group={group}
      owners={owners}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
      additionalMenuFooterItems={
        <Button
          type="button"
          onClick={() => {
            openIssueOwnershipRuleModal({
              project,
              organization,
              issueId: group.id,
              eventData: event!,
            });
          }}
          icon={<IconSettings />}
          size="xs"
        >
          {t('Ownership')}
        </Button>
      }
    />
  );
}
