import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button, LinkButton} from 'sentry/components/button';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import type {
  AutofixChangesStep,
  AutofixCodebaseChange,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type AutofixChangesProps = {
  groupId: string;
  onRetry: () => void;
  step: AutofixChangesStep;
};

function AutofixRepoChange({
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
            repo_id: change.repo_id,
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
    <Content>
      <RepoChangesHeader>
        <div>
          <Title>{change.repo_name}</Title>
          <PullRequestTitle>{change.title}</PullRequestTitle>
        </div>
        {!change.pull_request ? (
          <Actions>
            <Button
              size="xs"
              onClick={() => {
                createPr();
                setHasClickedCreatePr(true);
              }}
              icon={
                hasClickedCreatePr && (
                  <ProcessingStatusIndicator size={14} mini hideMessage />
                )
              }
              busy={hasClickedCreatePr}
              analyticsEventName="Autofix: Create PR Clicked"
              analyticsEventKey="autofix.create_pr_clicked"
              analyticsParams={{group_id: groupId}}
            >
              {t('Create a Pull Request')}
            </Button>
          </Actions>
        ) : (
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
        )}
      </RepoChangesHeader>
      <AutofixDiff diff={change.diff} />
    </Content>
  );
}

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
    <Content>
      {step.changes.map((change, i) => (
        <Fragment key={change.repo_id}>
          {i > 0 && <Separator />}
          <AutofixRepoChange change={change} groupId={groupId} />
        </Fragment>
      ))}
    </Content>
  );
}

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.textColor};
  margin-top: ${space(2)};
`;

const PrefixText = styled('span')``;

const Content = styled('div')`
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
`;

const Title = styled('div')`
  font-weight: bold;
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

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;
