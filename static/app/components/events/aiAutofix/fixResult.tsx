import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {AutofixData} from 'sentry/components/events/aiAutofix/types';
import Anchor from 'sentry/components/links/anchor';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  autofixData: AutofixData;
  onRetry: () => void;
};

const makeGithubRepoUrl = (repoName: string) => {
  return `https://github.com/${repoName}/`;
};

export function FixResult({autofixData, onRetry}: Props) {
  if (autofixData.status === 'PROCESSING') {
    return null;
  }

  const hasNoFix = !autofixData.fix && autofixData.status === 'COMPLETED';
  const hasError = autofixData.status === 'ERROR';

  return (
    <div>
      {hasError ? (
        <Content>
          <PreviewContent>
            {autofixData.error_message ? (
              <Fragment>
                <PrefixText>{t('Something went wrong:')}</PrefixText>
                {autofixData.error_message && <span>{autofixData.error_message}</span>}
              </Fragment>
            ) : (
              <span>{t('Something went wrong.')}</span>
            )}
          </PreviewContent>
          <Button size="xs" onClick={onRetry}>
            {t('Try Again')}
          </Button>
        </Content>
      ) : hasNoFix ? (
        <Content>
          <PreviewContent>
            <span>{t('Could not find a fix.')}</span>
          </PreviewContent>
          <Button size="xs" onClick={onRetry}>
            {t('Try Again')}
          </Button>
        </Content>
      ) : (
        <Content>
          <PreviewContent>
            <PrefixText>
              {tct('Pull request #[prNumber] created in [repository]:', {
                prNumber: autofixData.fix!.pr_number,
                repository: (
                  <RepoLink href={makeGithubRepoUrl(autofixData.fix!.repo_name)}>
                    {autofixData.fix!.repo_name}
                  </RepoLink>
                ),
              })}
            </PrefixText>
            <PrTitle>{autofixData.fix!.title}</PrTitle>
          </PreviewContent>
          <ButtonBar gap={1}>
            <Anchor href={autofixData.fix!.pr_url}>
              <Button size="xs" icon={<IconOpen size="xs" />}>
                {t('View Pull Request')}
              </Button>
            </Anchor>
            <Button size="xs" onClick={onRetry}>
              {t('Try Again')}
            </Button>
          </ButtonBar>
        </Content>
      )}
    </div>
  );
}

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.textColor};
`;

const PrefixText = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const PrTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  color: ${p => p.theme.textColor};
`;

const RepoLink = styled(Anchor)`
  text-decoration: underline;
`;

const Content = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;
