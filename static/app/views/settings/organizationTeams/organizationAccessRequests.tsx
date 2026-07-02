import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {t, tct} from 'sentry/locale';
import type {AccessRequest} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';

type Props = {
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  orgSlug: string;
  requestList: AccessRequest[];
};

export function OrganizationAccessRequests({
  orgSlug,
  requestList,
  onRemoveAccessRequest,
}: Props) {
  if (!requestList?.length) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>{t('Pending Team Requests')}</PanelHeader>

      <PanelBody>
        {requestList.map(accessRequest => (
          <AccessRequestItem
            key={accessRequest.id}
            accessRequest={accessRequest}
            orgSlug={orgSlug}
            onRemoveAccessRequest={onRemoveAccessRequest}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

function AccessRequestItem({
  accessRequest,
  orgSlug,
  onRemoveAccessRequest,
}: {
  accessRequest: AccessRequest;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  orgSlug: string;
}) {
  const {id, member, team, requester} = accessRequest;

  const {mutate, isPending} = useMutation({
    mutationFn: ({isApproved}: {isApproved: boolean}) => {
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${orgSlug}/access-requests/${id}/`,
        data: {isApproved},
      });
    },
    onSuccess: (_data, {isApproved}) => {
      onRemoveAccessRequest(id, isApproved);
      addSuccessMessage(
        isApproved ? t('Team request approved') : t('Team request denied')
      );
    },
    onError: (_error, {isApproved}) => {
      addErrorMessage(
        isApproved ? t('Error approving team request') : t('Error denying team request')
      );
    },
  });

  const memberName =
    member.user && (member.user.name || member.user.email || member.user.username);
  const requesterName =
    requester && (requester.name || requester.email || requester.username);

  return (
    <StyledPanelItem>
      <div data-test-id="request-message">
        {requesterName
          ? tct('[requesterName] requests to add [name] to the [team] team.', {
              requesterName,
              name: <strong>{memberName}</strong>,
              team: <strong>#{team.slug}</strong>,
            })
          : tct('[name] requests access to the [team] team.', {
              name: <strong>{memberName}</strong>,
              team: <strong>#{team.slug}</strong>,
            })}
      </div>
      <Flex gap="md">
        <Button
          variant="primary"
          size="sm"
          onClick={e => {
            e.stopPropagation();
            mutate({isApproved: true});
          }}
          busy={isPending}
        >
          {t('Approve')}
        </Button>
        <Button
          busy={isPending}
          onClick={e => {
            e.stopPropagation();
            mutate({isApproved: false});
          }}
          size="sm"
        >
          {t('Deny')}
        </Button>
      </Flex>
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${p => p.theme.space.xl};
  align-items: center;
`;
