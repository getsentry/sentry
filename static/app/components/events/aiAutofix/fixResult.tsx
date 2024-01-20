import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {AutofixData} from 'sentry/components/events/aiAutofix/types';
import Anchor from 'sentry/components/links/anchor';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {ExperimentalFeatureBadge} from '../aiSuggestedSolution/experimentalFeatureBadge';
import {SuggestionLoaderMessage} from '../aiSuggestedSolution/suggestionLoaderMessage';

type Props = {
  autofixData: AutofixData;
  onRetry: () => void;
};

const makeGithubRepoUrl = (repoName: string) => {
  return `https://github.com/${repoName}/`;
};

export function FixResult({autofixData, onRetry}: Props) {
  const isLoading = autofixData.status === 'PROCESSING';
  const hasNoFix = autofixData.status === 'COMPLETED' && !autofixData.fix;
  const hasError = autofixData.status === 'ERROR';

  return (
    <Panel>
      <Header>
        <Title>
          {t('AI Autofix')}
          <ExperimentalFeatureBadge />
        </Title>
      </Header>
      <PanelBody>
        {isLoading ? (
          <LoaderWrapper>
            <SmallerAiLoader className="ai-suggestion-wheel-of-fortune" />
            <SuggestionLoaderMessage />
          </LoaderWrapper>
        ) : hasError ? (
          <Content>
            <PreviewContent>
              {autofixData.errorMessage ? (
                <Fragment>
                  <PrefixText>Something went wrong:</PrefixText>
                  {autofixData.errorMessage && <span>{autofixData.errorMessage}</span>}
                </Fragment>
              ) : (
                <span>Something went wrong.</span>
              )}
            </PreviewContent>
            <Button size="xs" onClick={onRetry}>
              {t('Try Again')}
            </Button>
          </Content>
        ) : hasNoFix ? (
          <Content>
            <PreviewContent>
              <span>Could not find a fix.</span>
            </PreviewContent>
            <Button size="xs" onClick={onRetry}>
              {t('Try Again')}
            </Button>
          </Content>
        ) : (
          <Content>
            <PreviewContent>
              <PrefixText>
                Pull request #63088 created in{' '}
                <RepoLink href={makeGithubRepoUrl(autofixData.fix!.repoName)}>
                  getsentry/sentry
                </RepoLink>
                :
              </PrefixText>
              <PrTitle>{autofixData.fix!.title}</PrTitle>
            </PreviewContent>
            <Anchor href={autofixData.fix!.prUrl}>
              <Button size="xs" icon={<IconOpen size="xs" />}>
                {t('View Pull Request')}
              </Button>
            </Anchor>
          </Content>
        )}
      </PanelBody>
    </Panel>
  );
}

const Header = styled(PanelHeader)`
  background: transparent;
  padding: ${space(1)} ${space(2)};
  align-items: center;
  color: ${p => p.theme.gray300};
`;

const LoaderWrapper = styled('div')`
  padding: ${space(4)} 0;
  text-align: center;
  gap: ${space(2)};
  display: flex;
  flex-direction: column;
`;

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const PrefixText = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const PrTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
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
`;

const SmallerAiLoader = styled('div')`
  height: 128px;
`;

const Title = styled('div')`
  /* to be consistent with the feature badge size */
  height: ${space(2)};
  line-height: ${space(2)};
  display: flex;
  align-items: center;
`;
