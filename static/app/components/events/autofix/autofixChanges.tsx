import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ClippedBox from 'sentry/components/clippedBox';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';
import type {
  AutofixChangesStep,
  AutofixCodebaseChange,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

type AutofixChangesProps = {
  groupId: string;
  onRetry: () => void;
  step: AutofixChangesStep;
};

function CreatePullRequestButton({
  change,
  groupId,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
}) {
  const autofixData = useAutofixData({groupId});
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClickedCreatePr, setHasClickedCreatePr] = useState(false);

  const {mutate: createPr} = useMutation({
    mutationFn: () => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: autofixData?.run_id,
          payload: {
            type: 'create_pr',
            repo_external_id: change.repo_external_id,
            repo_id: change.repo_id, // The repo_id is only here for temporary backwards compatibility for LA customers, and we should remove it soon.
          },
        },
      });
    },
    onSuccess: () => {
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(groupId),
        data => {
          if (!data || !data.autofix) {
            return data;
          }

          return {
            ...data,
            autofix: {
              ...data.autofix,
              status: 'PROCESSING',
            },
          };
        }
      );
    },
    onError: () => {
      addErrorMessage(t('Failed to create a pull request'));
    },
  });

  useEffect(() => {
    if (hasClickedCreatePr && change.pull_request) {
      setHasClickedCreatePr(false);
    }
  }, [hasClickedCreatePr, change.pull_request]);

  return (
    <Button
      size="xs"
      onClick={() => {
        createPr();
        setHasClickedCreatePr(true);
      }}
      icon={
        hasClickedCreatePr && <ProcessingStatusIndicator size={14} mini hideMessage />
      }
      busy={hasClickedCreatePr}
      analyticsEventName="Autofix: Create PR Clicked"
      analyticsEventKey="autofix.create_pr_clicked"
      analyticsParams={{group_id: groupId}}
    >
      {t('Create a Pull Request')}
    </Button>
  );
}

function PullRequestLinkOrCreateButton({
  change,
  groupId,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
}) {
  const {data} = useAutofixSetup({groupId});

  if (change.pull_request) {
    return (
      <LinkButton
        size="xs"
        icon={<IconOpen size="xs" />}
        href={change.pull_request.pr_url}
        external
        analyticsEventName="Autofix: View PR Clicked"
        analyticsEventKey="autofix.view_pr_clicked"
        analyticsParams={{group_id: groupId}}
      >
        {t('View Pull Request')}
      </LinkButton>
    );
  }

  if (
    !data?.githubWriteIntegration?.repos?.find(
      repo => `${repo.owner}/${repo.name}` === change.repo_name
    )?.ok
  ) {
    return (
      <Actions>
        <Button
          size="xs"
          onClick={() => {
            openModal(deps => (
              <AutofixSetupWriteAccessModal {...deps} groupId={groupId} />
            ));
          }}
          analyticsEventName="Autofix: Create PR Setup Clicked"
          analyticsEventKey="autofix.create_pr_setup_clicked"
          analyticsParams={{group_id: groupId}}
          title={t('Enable write access to create pull requests')}
        >
          {t('Create a Pull Request')}
        </Button>
      </Actions>
    );
  }

  return (
    <Actions>
      <CreatePullRequestButton change={change} groupId={groupId} />
    </Actions>
  );
}

function AutofixRepoChange({
  change,
  groupId,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
}) {
  return (
    <Content>
      <RepoChangesHeader>
        <div>
          <Title>{change.repo_name}</Title>
          <PullRequestTitle>{change.title}</PullRequestTitle>
        </div>
        <PullRequestLinkOrCreateButton change={change} groupId={groupId} />
      </RepoChangesHeader>
      <AutofixDiff diff={change.diff} />
    </Content>
  );
}

const cardAnimationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0, y: 20},
  animate: {opacity: 1, y: 0},
  transition: testableTransition({duration: 0.3}),
};

export function AutofixChanges({step, onRetry, groupId}: AutofixChangesProps) {
  const data = useAutofixData({groupId});

  if (step.status === 'ERROR' || data?.status === 'ERROR') {
    return (
      <Content>
        <PreviewContent>
          {data?.error_message ? (
            <Fragment>
              <PrefixText>{t('Something went wrong')}</PrefixText>
              <span>{data.error_message}</span>
            </Fragment>
          ) : (
            <span>{t('Something went wrong.')}</span>
          )}
        </PreviewContent>
        <Actions>
          <Button size="xs" onClick={onRetry}>
            {t('Try Again')}
          </Button>
        </Actions>
      </Content>
    );
  }

  if (!step.changes.length) {
    return (
      <Content>
        <PreviewContent>
          <span>{t('Could not find a fix.')}</span>
        </PreviewContent>
        <Actions>
          <Button size="xs" onClick={onRetry}>
            {t('Try Again')}
          </Button>
        </Actions>
      </Content>
    );
  }

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <ChangesContainer>
          <ClippedBox clipHeight={408}>
            <HeaderText>{t('Fixes')}</HeaderText>
            {step.changes.map((change, i) => (
              <Fragment key={change.repo_external_id}>
                {i > 0 && <Separator />}
                <AutofixRepoChange change={change} groupId={groupId} />
              </Fragment>
            ))}
          </ClippedBox>
        </ChangesContainer>
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.textColor};
  margin-top: ${space(2)};
`;

const AnimationWrapper = styled(motion.div)``;

const PrefixText = styled('span')``;

const ChangesContainer = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  padding-top: ${space(1)};
`;

const Content = styled('div')`
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(0.5)};
`;

const PullRequestTitle = styled('div')`
  color: ${p => p.theme.subText};
`;

const RepoChangesHeader = styled('div')`
  padding: ${space(2)} 0;
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: ${space(1)};
`;

const Separator = styled('hr')`
  border: none;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: ${space(2)} -${space(2)} 0 -${space(2)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: 1.2em;
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;
