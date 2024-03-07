import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
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

function AutofixResultContent({autofixData, onRetry}: Props) {
  if (autofixData.status === 'ERROR') {
    return (
      <Content>
        <PreviewContent>
          {autofixData.error_message ? (
            <Fragment>
              <PrefixText>{t('Something went wrong')}</PrefixText>
              {autofixData.error_message && <span>{autofixData.error_message}</span>}
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

  if (!autofixData.fix) {
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
      <PreviewContent>
        <PrefixText>
          {tct('Pull request #[prNumber] created in [repository]', {
            prNumber: autofixData.fix.pr_number,
            repository: (
              <ExternalLink href={makeGithubRepoUrl(autofixData.fix.repo_name)}>
                {autofixData.fix.repo_name}
              </ExternalLink>
            ),
          })}
        </PrefixText>
        <PrTitle>{autofixData.fix.title}</PrTitle>
      </PreviewContent>
      <Actions>
        <ButtonBar gap={1}>
          <Button size="xs" onClick={onRetry}>
            {t('Try Again')}
          </Button>
          <LinkButton
            size="xs"
            icon={<IconOpen size="xs" />}
            href={autofixData.fix.pr_url}
            external
          >
            {t('View Pull Request')}
          </LinkButton>
        </ButtonBar>
      </Actions>
    </Content>
  );
}

export function AutofixResult({autofixData, onRetry}: Props) {
  if (autofixData.status === 'PROCESSING') {
    return null;
  }

  return (
    <ResultPanel>
      <Title>{t('Review Suggested Fix')}</Title>
      <AutofixResultContent autofixData={autofixData} onRetry={onRetry} />
    </ResultPanel>
  );
}

const ResultPanel = styled(Panel)`
  padding: ${space(2)};
  margin: 0;
`;

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.textColor};
`;

const PrefixText = styled('span')``;

const PrTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  color: ${p => p.theme.textColor};
`;

const Content = styled('div')``;

const Title = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(2)};
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(1)};
`;
