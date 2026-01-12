import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

function GitRepoLink({repo}: {repo: {name: string; owner: string; ok?: boolean}}) {
  return (
    <RepoItem isOk={repo.ok}>
      <ExternalLink href={`https://github.com/${repo.owner}/${repo.name}`}>
        {repo.owner}/{repo.name}
      </ExternalLink>
      {repo.ok && <IconCheckmark variant="success" size="sm" />}
    </RepoItem>
  );
}

interface AutofixSetupWriteAccessModalProps extends ModalRenderProps {
  groupId: string;
}

function Content({groupId, closeModal}: {closeModal: () => void; groupId: string}) {
  const {canCreatePullRequests, data} = useAutofixSetup(
    {groupId, checkWriteAccess: true},
    {refetchOnWindowFocus: true} // We want to check each time the user comes back to the tab
  );

  const sortedRepos = useMemo(
    () =>
      data?.githubWriteIntegration?.repos.toSorted((a: any, b: any) => {
        if (a.ok === b.ok) {
          return `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`);
        }
        return a.ok ? -1 : 1;
      }) ?? [],
    [data]
  );

  if (canCreatePullRequests) {
    return (
      <DoneWrapper>
        <DoneIcon variant="success" size="2xl" />
        <p>{t("You've successfully configured write access!")}</p>
        <Button onClick={closeModal} priority="primary">
          {t("Let's go")}
        </Button>
      </DoneWrapper>
    );
  }

  if (sortedRepos.length > 0) {
    return (
      <Fragment>
        <p>
          {tct(
            'In order to create pull requests, install and grant write access to the [link:Sentry Seer GitHub App] for the following repositories:',
            {
              link: (
                <ExternalLink href="https://github.com/apps/seer-by-sentry/installations/new" />
              ),
            }
          )}
        </p>
        <RepoLinkUl>
          {sortedRepos.map((repo: any) => (
            <GitRepoLink key={`${repo.owner}/${repo.name}`} repo={repo} />
          ))}
        </RepoLinkUl>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'In order to create pull requests, install and grant write access to the [link:Sentry Seer GitHub App] for the relevant repositories.',
          {
            link: (
              <ExternalLink href="https://github.com/apps/seer-by-sentry/installations/new" />
            ),
          }
        )}
      </p>
    </Fragment>
  );
}

export function AutofixSetupWriteAccessModal({
  Header,
  Body,
  Footer,
  groupId,
  closeModal,
}: AutofixSetupWriteAccessModalProps) {
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;
  const {canCreatePullRequests} = useAutofixSetup({groupId, checkWriteAccess: true});

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
    };
  }, [queryClient, orgSlug, groupId]);

  return (
    <div id="autofix-write-access-modal">
      <Header closeButton>
        <h3>{t('Allow Seer to Make Pull Requests')}</h3>
      </Header>
      <Body>
        <Content groupId={groupId} closeModal={closeModal} />
      </Body>
      {!canCreatePullRequests && (
        <Footer>
          <ButtonBar>
            <Button onClick={closeModal}>{t('Later')}</Button>
            <LinkButton
              href="https://github.com/apps/seer-by-sentry/installations/new"
              external
              priority="primary"
            >
              {t('Install the Seer GitHub App')}
            </LinkButton>
          </ButtonBar>
        </Footer>
      )}
    </div>
  );
}

const DoneWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 40px;
  font-size: ${p => p.theme.fontSize.lg};
`;

const DoneIcon = styled(IconCheckmark)`
  margin-bottom: ${space(4)};
`;

const RepoLinkUl = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: 0;
`;

const RepoItem = styled('li')<{isOk?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
  padding: ${space(1)};
  margin-bottom: ${space(0.5)};
  background-color: ${p => (p.isOk ? p.theme.colors.green100 : 'transparent')};
  border-radius: ${p => p.theme.radius.md};
`;
