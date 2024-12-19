import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';
import type {AutofixCodebaseChange} from 'sentry/components/events/autofix/types';
import {
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

function CreatePRsButton({
  changes,
  groupId,
  changesStepId,
  isPrimary = true,
}: {
  changes: AutofixCodebaseChange[];
  changesStepId: string;
  groupId: string;
  isPrimary?: boolean;
}) {
  const autofixData = useAutofixData({groupId});
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClickedCreatePr, setHasClickedCreatePr] = useState(false);

  const createPRs = () => {
    setHasClickedCreatePr(true);
    for (const change of changes) {
      createPr({change});
    }
  };

  const {mutate: createPr} = useMutation({
    mutationFn: ({change}: {change: AutofixCodebaseChange}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: autofixData?.run_id,
          payload: {
            type: 'create_pr',
            repo_external_id: change.repo_external_id,
            changes_step_id: changesStepId,
          },
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Created pull requests.'));
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
    },
    onError: () => {
      setHasClickedCreatePr(false);
      addErrorMessage(t('Failed to create a pull request'));
    },
  });

  return (
    <Button
      priority={isPrimary ? 'primary' : 'default'}
      onClick={createPRs}
      icon={
        hasClickedCreatePr && <ProcessingStatusIndicator size={14} mini hideMessage />
      }
      busy={hasClickedCreatePr}
      analyticsEventName="Autofix: Create PR Clicked"
      analyticsEventKey="autofix.create_pr_clicked"
      analyticsParams={{group_id: groupId}}
      size="sm"
    >
      {changes.length > 1 ? t('Create PRs') : t('Create a PR')}
    </Button>
  );
}

export function SetupAndCreatePRsButton({
  changes,
  groupId,
  changesStepId,
  hasStepBelow,
  isPrimary = true,
}: {
  changes: AutofixCodebaseChange[];
  changesStepId: string;
  groupId: string;
  hasStepBelow?: boolean;
  isPrimary?: boolean;
}) {
  const {data: setupData} = useAutofixSetup({groupId, checkWriteAccess: true});

  const areAllReposWriteable = changes.every(
    change =>
      setupData?.githubWriteIntegration?.repos?.find(
        repo => `${repo.owner}/${repo.name}` === change.repo_name
      )?.ok
  );

  if (!areAllReposWriteable) {
    return (
      <Button
        priority={hasStepBelow ? 'default' : 'primary'}
        onClick={() => {
          openModal(deps => <AutofixSetupWriteAccessModal {...deps} groupId={groupId} />);
        }}
        analyticsEventName="Autofix: Create PR Setup Clicked"
        analyticsEventKey="autofix.create_pr_setup_clicked"
        analyticsParams={{group_id: groupId}}
        title={t('Enable write access to create pull requests')}
        size="sm"
      >
        {changes.length > 1 ? t('Create PRs') : t('Create a PR')}
      </Button>
    );
  }

  return (
    <CreatePRsButton
      changes={changes}
      groupId={groupId}
      changesStepId={changesStepId}
      isPrimary={isPrimary}
    />
  );
}

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;
