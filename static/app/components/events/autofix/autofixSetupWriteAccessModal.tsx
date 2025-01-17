import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {GitRepoLink} from 'sentry/components/events/autofix/autofixSetupModal';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
        <DoneIcon color="success" size="xxl" isCircled />
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
            'In order to create pull requests, install and grant write access to the [link:Sentry Autofix GitHub App] for the following repositories:',
            {
              link: (
                <ExternalLink
                  href={`https://github.com/apps/sentry-autofix/installations/new`}
                />
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
          'In order to create pull requests, install and grant write access to the [link:Sentry Autofix GitHub App] for the relevant repositories.',
          {
            link: (
              <ExternalLink
                href={`https://github.com/apps/sentry-autofix/installations/new`}
              />
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
  const {canCreatePullRequests} = useAutofixSetup({groupId, checkWriteAccess: true});

  return (
    <div id="autofix-write-access-modal">
      <Header closeButton>
        <h3>{t('Allow Autofix to Make Pull Requests')}</h3>
      </Header>
      <Body>
        <Content groupId={groupId} closeModal={closeModal} />
      </Body>
      {!canCreatePullRequests && (
        <Footer>
          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Later')}</Button>
            <LinkButton
              href="https://github.com/apps/sentry-autofix/installations/new"
              external
              priority="primary"
            >
              {t('Install the Autofix GitHub App')}
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
  font-size: ${p => p.theme.fontSizeLarge};
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
