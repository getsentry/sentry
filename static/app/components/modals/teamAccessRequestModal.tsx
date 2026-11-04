import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {
  ModalRenderProps,
  TeamAccessRequestModalOptions,
} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

export interface CreateTeamAccessRequestModalProps
  extends ModalRenderProps, TeamAccessRequestModalOptions {
  memberId: string;
  orgId: string;
  teamId: string;
}

function CreateTeamAccessRequestModal(props: CreateTeamAccessRequestModalProps) {
  const {memberId, orgId, teamId, closeModal, Body, Footer} = props;

  const {mutate: createRequest, isPending} = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/members/$memberId/teams/$teamIdOrSlug/',
          {path: {organizationIdOrSlug: orgId, memberId, teamIdOrSlug: teamId}}
        ),
        method: 'POST',
      }),
    onSuccess: () => addSuccessMessage(t('Team request sent for approval')),
    onError: () => addErrorMessage(t('Unable to send team request')),
    onSettled: () => closeModal(),
  });

  return (
    <Fragment>
      <Body>
        {tct(
          'You do not have permission to add members to the #[team] team, but we will send a request to your organization admins for approval.',
          {team: teamId}
        )}
      </Body>
      <Footer>
        <Grid gap="md" columns="max-content max-content">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => createRequest()}
            busy={isPending}
            autoFocus
          >
            {t('Continue')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}

export default CreateTeamAccessRequestModal;
