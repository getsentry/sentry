import {css} from '@emotion/react';
import styled from '@emotion/styled';
import merge from 'lodash/merge';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {User} from 'sentry/types';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';

type UpdateUserOptionsVariables = Partial<User['options']>;

export function NewIssueExperienceButton() {
  const user = useUser();
  const api = useApi();

  const newIssueExperienceEnabled =
    user?.options?.issueDetailsNewExperienceQ42023 ?? false;

  const {mutate} = useMutation({
    mutationFn: (options: UpdateUserOptionsVariables) => {
      return api.requestPromise('/users/me/', {
        method: 'PUT',
        data: {
          options,
        },
      });
    },
    onMutate: (options: UpdateUserOptionsVariables) => {
      ConfigStore.set('user', merge({}, user, {options}));
    },
    onError: () => {
      addErrorMessage('Failed to save new issue experience preference');
    },
  });

  const label = newIssueExperienceEnabled
    ? t('Switch to the old issue experience')
    : t('Switch to the new issue experience');

  return (
    <StyledButton
      enabled={newIssueExperienceEnabled}
      size="sm"
      icon={<IconLab isSolid={newIssueExperienceEnabled} />}
      title={label}
      aria-label={label}
      onClick={() =>
        mutate({['issueDetailsNewExperienceQ42023']: !newIssueExperienceEnabled})
      }
    />
  );
}

const StyledButton = styled(Button)<{enabled: boolean}>`
  ${p =>
    p.enabled &&
    css`
      color: ${p.theme.button.primary.background};

      :hover {
        color: ${p.theme.button.primary.background};
      }
    `}
`;
