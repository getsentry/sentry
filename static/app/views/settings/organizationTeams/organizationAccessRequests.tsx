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
  const {mutate, isPending, variables} = useMutation({
    mutationFn: ({id, isApproved}: {id: string; isApproved: boolean}) => {
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${orgSlug}/access-requests/${id}/`,
        data: {isApproved},
      });
    },
    onSuccess: (_data, {id, isApproved}) => {
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

  if (!requestList?.length) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader>{t('Pending Team Requests')}</PanelHeader>

      <PanelBody>
        {requestList.map(({id, member, team, requester}) => {
          const memberName =
            member.user &&
            (member.user.name || member.user.email || member.user.username);
          const requesterName =
            requester && (requester.name || requester.email || requester.username);
          const isBusy = isPending && variables?.id === id;
          return (
            <StyledPanelItem key={id}>
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
                    mutate({id, isApproved: true});
                  }}
                  busy={isBusy}
                >
                  {t('Approve')}
                </Button>
                <Button
                  busy={isBusy}
                  onClick={e => {
                    e.stopPropagation();
                    mutate({id, isApproved: false});
                  }}
                  size="sm"
                >
                  {t('Deny')}
                </Button>
              </Flex>
            </StyledPanelItem>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${p => p.theme.space.xl};
  align-items: center;
`;
