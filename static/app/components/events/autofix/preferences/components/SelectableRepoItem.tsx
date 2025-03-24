import styled from '@emotion/styled';

import type {Repository} from 'sentry/components/events/autofix/types';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  isSelected: boolean;
  onToggle: () => void;
  repo: Repository;
}

export function SelectableRepoItem({repo, isSelected, onToggle}: Props) {
  const isGithub = repo.provider?.name?.toLowerCase() === 'github';

  const tooltipMessage = isGithub
    ? ''
    : t('Support for %s will be coming soon', repo.provider?.name || t('this provider'));

  const repoContent = (
    <RepoListItemContainer
      selected={isSelected}
      onClick={() => isGithub && onToggle()}
      disabled={!isGithub}
      role="button"
      tabIndex={0}
      data-repo-id={repo.externalId}
    >
      <RepoHeader>
        <RepoInfoWrapper>
          <RepoName>{repo.name}</RepoName>
          <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>
        </RepoInfoWrapper>
        <ActionContainer>
          {isSelected ? (
            <SelectedIndicator>{t('Added')}</SelectedIndicator>
          ) : (
            isGithub && <AddIcon size="xs" />
          )}
        </ActionContainer>
      </RepoHeader>
    </RepoListItemContainer>
  );

  return isGithub ? (
    repoContent
  ) : (
    <Tooltip title={tooltipMessage} showUnderline={false}>
      {repoContent}
    </Tooltip>
  );
}

// Styled components
const BaseRepoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const RepoListItemContainer = styled(BaseRepoContainer)<{
  selected: boolean;
  disabled?: boolean;
}>`
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  transition: background-color 0.1s ease;
  border: 1px solid ${p => (p.selected ? p.theme.purple300 : p.theme.border)};
  opacity: ${p => (p.disabled ? 0.65 : 1)};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  ${p =>
    p.selected &&
    `
    background-color: ${p.theme.surface100};
  `}
`;

const RepoHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
`;

const RepoInfoWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(1)};
`;

const RepoName = styled('div')`
  font-weight: 600;
`;

const RepoProvider = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const SelectedIndicator = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  color: ${p => p.theme.activeText};
  background-color: ${p => p.theme.active};
  padding: ${space(0.25)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
`;

const ActionContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const AddIcon = styled(IconAdd)`
  color: ${p => p.theme.gray300};
  visibility: hidden;

  ${RepoListItemContainer}:hover & {
    visibility: visible;
  }

  &:hover {
    color: ${p => p.theme.purple300};
  }
`;
