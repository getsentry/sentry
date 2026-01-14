import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import {Tooltip} from 'sentry/components/core/tooltip';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';

interface Props {
  isSelected: boolean;
  onToggle: (repoId: string) => void;
  repo: Repository;
}

export function SelectableRepoItem({repo, isSelected, onToggle}: Props) {
  const isSupportedProvider = isSupportedAutofixProvider(repo.provider);

  return (
    <RepoListItemContainer
      selected={isSelected}
      disabled={!isSupportedProvider}
      role="button"
      tabIndex={0}
      data-repo-id={repo.externalId}
      onClick={() => {
        if (isSupportedProvider) {
          onToggle(repo.externalId);
        }
      }}
    >
      <Tooltip
        title={t('Support for %s will be coming soon', repo.provider?.name)}
        showUnderline={false}
        disabled={isSupportedProvider}
      >
        <RepoHeader>
          <RepoInfoWrapper>
            <RepoName>{repo.name}</RepoName>

            <SelectionWrapper>
              <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>

              <StyledCheckbox
                checked={isSelected}
                size="sm"
                readOnly
                disabled={!isSupportedProvider}
              />
            </SelectionWrapper>
          </RepoInfoWrapper>
        </RepoHeader>
      </Tooltip>
    </RepoListItemContainer>
  );
}

const RepoListItemContainer = styled('div')<{
  selected: boolean;
  disabled?: boolean;
}>`
  display: flex;
  flex-direction: column;
  width: 100%;
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  transition: background-color 0.1s ease;
  opacity: ${p => (p.disabled ? 0.65 : 1)};
  padding-left: ${space(1.5)};

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  ${p =>
    p.selected &&
    css`
      background-color: ${p.theme.colors.surface200};

      &:hover {
        background-color: ${p.theme.colors.surface200};
      }
    `}
`;

const RepoHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(1.5)};
`;

const RepoInfoWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  justify-content: space-between;
`;

const RepoName = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const RepoProvider = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  margin-top: ${space(0.25)};
`;

const StyledCheckbox = styled(Checkbox)`
  margin: 0;
`;

const SelectionWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
