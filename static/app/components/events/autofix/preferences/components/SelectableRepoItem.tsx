import styled from '@emotion/styled';

import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';

interface Props {
  isSelected: boolean;
  onToggle: () => void;
  repo: Repository;
}

export function SelectableRepoItem({repo, isSelected, onToggle}: Props) {
  const isSupportedProvider = isSupportedAutofixProvider(repo.provider?.name || '');

  const tooltipMessage = isSupportedProvider
    ? ''
    : t('Support for %s will be coming soon', repo.provider?.name || t('this provider'));

  const repoContent = (
    <RepoListItemContainer
      selected={isSelected}
      onClick={() => isSupportedProvider && onToggle()}
      disabled={!isSupportedProvider}
      role="button"
      tabIndex={0}
      data-repo-id={repo.externalId}
    >
      <RepoHeader>
        <RepoInfoWrapper>
          <RepoName>{repo.name}</RepoName>
          <RightAlign>
            <RepoProvider>{repo.provider?.name || t('Unknown Provider')}</RepoProvider>
            {isSupportedProvider && <AddIcon size="xs" />}
          </RightAlign>
        </RepoInfoWrapper>
      </RepoHeader>
    </RepoListItemContainer>
  );

  return isSupportedProvider ? (
    repoContent
  ) : (
    <Tooltip title={tooltipMessage} showUnderline={false}>
      {repoContent}
    </Tooltip>
  );
}

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
  font-weight: ${p => p.theme.fontWeightBold};
`;

const RepoProvider = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
`;

const AddIcon = styled(IconAdd)`
  color: ${p => p.theme.gray300};

  ${RepoListItemContainer}:hover & {
    color: ${p => p.theme.purple300};
  }
`;

const RightAlign = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
