import {type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';

import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd, IconChevron, IconInfo, IconSearch, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOverlay from 'sentry/utils/useOverlay';

import {SelectableRepoItem} from './components/SelectableRepoItem';
import {SelectedRepoItem} from './components/SelectedRepoItem';
import {useOrganizationRepositories} from './hooks/useOrganizationRepositories';
import {useProjectPreferences} from './hooks/useProjectPreferences';
import {useSaveProjectPreferences} from './hooks/useSaveProjectPreferences';

const MAX_REPOS_LIMIT = 8;

const withUnits = (value: any) => (typeof value === 'string' ? value : `${value}px`);

function AutofixPreferenceDropdown({project}: {project: Project}) {
  const {data: repositories, isFetching: isFetchingRepositories} =
    useOrganizationRepositories();
  const {
    preference,
    codeMappingRepos,
    isLoading: isLoadingPreferences,
  } = useProjectPreferences(project);
  const {mutate: savePreferences} = useSaveProjectPreferences(project);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [repoSettings, setRepoSettings] = useState<Record<string, RepoSettings>>({});
  const [showAddRepositories, setShowAddRepositories] = useState(false);
  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (repositories) {
      if (preference?.repositories) {
        // Handle existing preferences
        const preferencesMap = new Map(
          preference.repositories.map(repo => [
            repo.external_id,
            {
              branch: repo.branch_name || '',
              instructions: repo.instructions || '',
            },
          ])
        );

        setSelectedRepoIds(preference.repositories.map(repo => repo.external_id));

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = preferencesMap.get(repo.externalId) || {
            branch: '',
            instructions: '',
          };
        });

        setRepoSettings(initialSettings);
      } else if (codeMappingRepos?.length) {
        // Set default settings using codeMappingRepos when no preferences exist
        const repoIds = codeMappingRepos.map(repo => repo.external_id);
        setSelectedRepoIds(repoIds);

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = {
            branch: '',
            instructions: '',
          };
        });

        setRepoSettings(initialSettings);

        savePreferences({repositories: codeMappingRepos});
      }
    }
  }, [preference, repositories, codeMappingRepos, savePreferences]);

  const savePreferencesToServer = useCallback(
    (updatedIds?: string[], updatedSettings?: Record<string, RepoSettings>) => {
      if (!repositories) {
        return;
      }

      const idsToUse = updatedIds || selectedRepoIds;
      const settingsToUse = updatedSettings || repoSettings;
      const selectedRepos = repositories.filter(repo =>
        idsToUse.includes(repo.externalId)
      );

      const reposData = selectedRepos.map(repo => {
        const [owner, name] = (repo.name || '/').split('/');
        return {
          provider: repo.provider?.name?.toLowerCase() || '',
          owner: owner || '',
          name: name || repo.name || '',
          external_id: repo.externalId,
          branch_name: settingsToUse[repo.externalId]?.branch || '',
          instructions: settingsToUse[repo.externalId]?.instructions || '',
        };
      });

      savePreferences({
        repositories: reposData,
      });

      setShowSaveNotice(true);
    },
    [repositories, selectedRepoIds, repoSettings, savePreferences]
  );

  const saveScrollPosition = useCallback(() => {
    if (!contentRef.current) {
      return 0;
    }
    return contentRef.current.scrollTop;
  }, []);

  const restoreScrollPosition = useCallback((position: number) => {
    if (!contentRef.current) {
      return;
    }
    contentRef.current.scrollTop = position;
  }, []);

  const toggleRepositorySelection = useCallback(
    (repoId: string) => {
      const scrollPosition = saveScrollPosition();

      setSelectedRepoIds(prevSelectedIds => {
        if (prevSelectedIds.includes(repoId)) {
          const newIds = prevSelectedIds.filter(id => id !== repoId);
          setTimeout(() => savePreferencesToServer(newIds), 500);
          return newIds;
        }
        if (prevSelectedIds.length >= MAX_REPOS_LIMIT) {
          setTimeout(() => {
            setShowAddRepositories(false);
          }, 300);
          return prevSelectedIds;
        }

        if (prevSelectedIds.length === MAX_REPOS_LIMIT - 1) {
          setTimeout(() => {
            setShowAddRepositories(false);
          }, 300);
        }

        const newIds = [...prevSelectedIds, repoId];
        setSearchQuery('');
        setTimeout(() => savePreferencesToServer(newIds), 500);
        return newIds;
      });

      setTimeout(() => {
        restoreScrollPosition(scrollPosition);
      }, 0);
    },
    [saveScrollPosition, restoreScrollPosition, savePreferencesToServer, setSearchQuery]
  );

  const removeRepository = useCallback(
    (repoId: string) => {
      const scrollPosition = saveScrollPosition();

      setSelectedRepoIds(prevSelectedIds => {
        const newIds = prevSelectedIds.filter(id => id !== repoId);
        setTimeout(() => savePreferencesToServer(newIds), 500);
        return newIds;
      });

      setTimeout(() => {
        restoreScrollPosition(scrollPosition);
      }, 0);
    },
    [saveScrollPosition, restoreScrollPosition, savePreferencesToServer]
  );

  const updateRepoSettings = useCallback(
    (repoId: string, settings: RepoSettings) => {
      setRepoSettings(prev => {
        const newSettings = {
          ...prev,
          [repoId]: settings,
        };

        setTimeout(() => savePreferencesToServer(undefined, newSettings), 500);

        return newSettings;
      });
    },
    [savePreferencesToServer]
  );

  const {selectedRepositories, unselectedRepositories, filteredRepositories} =
    useMemo(() => {
      if (!repositories || repositories.length === 0) {
        return {
          selectedRepositories: [],
          unselectedRepositories: [],
          filteredRepositories: [],
        };
      }

      const selected = repositories.filter(repo =>
        selectedRepoIds.includes(repo.externalId)
      );
      const unselected = repositories.filter(
        repo => !selectedRepoIds.includes(repo.externalId)
      );

      let filtered = unselected;
      if (showAddRepositories && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = unselected.filter(repo => repo.name.toLowerCase().includes(query));
      } else if (!showAddRepositories && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = selected.filter(repo => repo.name.toLowerCase().includes(query));
      } else if (showAddRepositories) {
        filtered = unselected;
      } else {
        filtered = selected;
      }

      filtered = filtered.filter(
        repo => repo.provider?.id && repo.provider.id !== 'unknown'
      );

      return {
        selectedRepositories: selected,
        unselectedRepositories: unselected,
        filteredRepositories: filtered,
      };
    }, [repositories, selectedRepoIds, searchQuery, showAddRepositories]);

  const sectionTitle = showAddRepositories
    ? t('Add Repositories')
    : selectedRepoIds.length === 0
      ? t('No Repositories Selected')
      : selectedRepoIds.length === 1
        ? t('1 Selected Repository')
        : t('%s Selected Repositories', selectedRepoIds.length);

  const toggleAddRepositoriesView = useCallback(() => {
    setShowAddRepositories(!showAddRepositories);
    setSearchQuery('');

    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }, 0);
  }, [showAddRepositories]);

  const isRepoLimitReached = selectedRepoIds.length >= MAX_REPOS_LIMIT;

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const scrollPosition = saveScrollPosition();
      setSearchQuery(e.target.value);
      setTimeout(() => restoreScrollPosition(scrollPosition), 0);
    },
    [saveScrollPosition, restoreScrollPosition]
  );

  const {
    isOpen,
    state: overlayState,
    triggerProps,
    overlayProps,
  } = useOverlay({
    type: 'menu',
    position: 'bottom-start',
    offset: 4,
    isDismissable: true,
    shouldCloseOnBlur: true,
    onOpenChange: open => {
      if (open && searchRef.current) {
        setTimeout(() => {
          searchRef.current?.focus();
        }, 0);
      }
    },
  });

  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (e.key === 'Escape') {
        overlayState.close();
      }
    },
  });

  return (
    <DropdownWrap>
      <Button
        {...triggerProps}
        size="xs"
        title={t('Project Settings for Autofix')}
        aria-label={t('Project Settings for Autofix')}
        icon={<IconSettings />}
      />

      <StyledPositionWrapper
        zIndex={theme.zIndex?.tooltip}
        visible={isOpen}
        {...overlayProps}
      >
        <StyledOverlay
          width="480px"
          maxHeight="32rem"
          data-menu-has-header
          data-menu-has-search
        >
          <FocusScope contain={isOpen}>
            <div {...keyboardProps}>
              <ContentContainer ref={contentRef} className="scrollable-content">
                <ContentHeader>
                  <ContentTitle>
                    {t('Configure Autofix for %s', project.name.toUpperCase())}
                  </ContentTitle>
                </ContentHeader>
                {showSaveNotice && (
                  <SaveNotice>
                    <IconInfo size="md" />
                    {t(
                      'Changes will apply to the next run. Hit "Start Over" then start a new run for Autofix to use your changes.'
                    )}
                  </SaveNotice>
                )}
                <SectionHeader>
                  <SectionTitle>
                    {sectionTitle}
                    {!showAddRepositories && (
                      <QuestionTooltip
                        title={t(
                          'Below are the repositories that Autofix will work on. Autofix will only be able to see code from and make PRs to the repositories that you select here.'
                        )}
                        size="sm"
                      />
                    )}
                  </SectionTitle>
                  <AddReposButton
                    size="xs"
                    icon={
                      showAddRepositories ? <IconChevron direction="left" /> : <IconAdd />
                    }
                    title={
                      showAddRepositories
                        ? ''
                        : isRepoLimitReached
                          ? t('Max repositories reached')
                          : unselectedRepositories?.length === 0
                            ? t('No repositories to add')
                            : ''
                    }
                    disabled={
                      !showAddRepositories &&
                      (isRepoLimitReached || unselectedRepositories?.length === 0)
                    }
                    onClick={toggleAddRepositoriesView}
                  >
                    {showAddRepositories ? t('Back to Selected') : t('Add Repos')}
                  </AddReposButton>
                </SectionHeader>
                {showAddRepositories && (
                  <SearchContainer>
                    <InputGroup>
                      <InputGroup.LeadingItems disablePointerEvents>
                        <IconSearch size="sm" />
                      </InputGroup.LeadingItems>
                      <InputGroup.Input
                        ref={searchRef}
                        type="text"
                        placeholder={t('Search repositories...')}
                        value={searchQuery}
                        autoFocus
                        onChange={handleSearchChange}
                      />
                    </InputGroup>
                  </SearchContainer>
                )}
                {isFetchingRepositories || isLoadingPreferences ? (
                  <LoadingContainer>
                    <StyledLoadingIndicator size={36} />
                    <LoadingMessage>
                      {t('Loading all your messy repositories...')}
                    </LoadingMessage>
                  </LoadingContainer>
                ) : filteredRepositories.length === 0 ? (
                  <EmptyMessage>
                    {showAddRepositories
                      ? unselectedRepositories.length > 0
                        ? t('No matching repositories found.')
                        : t('All repositories have been added.')
                      : selectedRepositories.length > 0
                        ? t('No matching repositories found.')
                        : t(
                            'No repositories selected. Click "Add repositories" to get started.'
                          )}
                  </EmptyMessage>
                ) : (
                  <ReposContainer>
                    {showAddRepositories
                      ? filteredRepositories.map(repo => (
                          <SelectableRepoItem
                            key={repo.id}
                            repo={repo}
                            isSelected={selectedRepoIds.includes(repo.externalId)}
                            onToggle={() => toggleRepositorySelection(repo.externalId)}
                          />
                        ))
                      : filteredRepositories.map(repo => (
                          <SelectedRepoItem
                            key={repo.id}
                            repo={repo}
                            settings={
                              repoSettings[repo.externalId] || {
                                branch: '',
                                instructions: '',
                              }
                            }
                            onSettingsChange={settings =>
                              updateRepoSettings(repo.externalId, settings)
                            }
                            onRemove={() => removeRepository(repo.externalId)}
                          />
                        ))}
                  </ReposContainer>
                )}
              </ContentContainer>
            </div>
          </FocusScope>
        </StyledOverlay>
      </StyledPositionWrapper>
    </DropdownWrap>
  );
}

export default React.memo(AutofixPreferenceDropdown);

const DropdownWrap = styled('div')`
  position: relative;
  width: max-content;
`;

const StyledPositionWrapper = styled(PositionWrapper, {
  shouldForwardProp: prop => isPropValid(prop),
})<{visible?: boolean}>`
  min-width: 100%;
  display: ${p => (p.visible ? 'block' : 'none')};
`;

const StyledOverlay = styled(Overlay, {
  shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
})<{
  maxHeight?: string | number;
  maxWidth?: string | number;
  minWidth?: string | number;
  width?: string | number;
}>`
  display: flex;
  flex-direction: column;
  overflow: hidden;

  ${p => p.width && `width: ${withUnits(p.width)};`}
  ${p => p.minWidth && `min-width: ${withUnits(p.minWidth)};`}
  max-width: ${p => (p.maxWidth ? `min(${withUnits(p.maxWidth)}, 100%)` : `100%`)};
  max-height: ${p => (p.maxHeight ? `${withUnits(p.maxHeight)}` : 'auto')};

  & > div {
    width: 100%;
    height: 100%;
  }
`;

const ContentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
  height: 100%;
  overflow-y: auto;
  max-height: 30rem;

  &:focus {
    outline: none;
  }
`;

const ContentHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-bottom: ${space(1)};
`;

const ContentTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;

const SectionHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1.5)};
`;

const SectionTitle = styled('h4')`
  display: flex;
  align-items: center;
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  gap: ${space(0.5)};
`;

const AddReposButton = styled(Button)`
  flex-shrink: 0;
`;

const SearchContainer = styled('div')`
  margin-bottom: ${space(1.5)};
`;

const ReposContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const EmptyMessage = styled('div')`
  padding: ${space(2)};
  color: ${p => p.theme.subText};
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(4)};
  width: 100%;
  flex-direction: column;
  gap: ${space(2)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const SaveNotice = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1.5)};
  margin-bottom: ${space(1.5)};
  background-color: ${p => p.theme.alert.warning.backgroundLight};
  border: 1px solid ${p => p.theme.alert.warning.border};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.alert.warning.color};
`;
