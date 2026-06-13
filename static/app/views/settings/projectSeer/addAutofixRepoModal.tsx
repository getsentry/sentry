import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import styled from '@emotion/styled';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MAX_REPOS_LIMIT} from 'sentry/views/settings/projectSeer/constants';

import {SelectableRepoItem} from './selectableRepoItem';

type Props = ModalRenderProps & {
  /**
   * Repositories currently selected for Autofix in the parent component.
   */
  hiddenExternalIds: string[];

  /**
   * Callback function triggered when the modal is saved.
   */
  onSave: ({
    selectedExternalIds,
    selectedRepoIds,
  }: {
    selectedExternalIds: string[];
    selectedRepoIds: string[];
  }) => void;
};

export function AddAutofixRepoModal({
  hiddenExternalIds,
  onSave,
  Header,
  Body,
  Footer,
  closeModal,
}: Props) {
  const organization = useOrganization();

  const repositoriesQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: repositoriesQuery});
  const {data: repositories, isFetching: isFetchingRepositories} = repositoriesQuery;

  const filteredRepositories = useMemo(() => {
    if (!repositories) {
      return [];
    }
    return repositories.filter(repo => !hiddenExternalIds.includes(repo.externalId));
  }, [repositories, hiddenExternalIds]);

  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [showMaxLimitAlert, setShowMaxLimitAlert] = useState(false);

  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>([]);

  const handleToggleRepository = useCallback((externalId: string) => {
    setSelectedExternalIds(prev => {
      if (prev.includes(externalId)) {
        return prev.filter(id => id !== externalId);
      }
      return [...prev, externalId];
    });
  }, []);

  useEffect(() => {
    setShowMaxLimitAlert(selectedExternalIds.length >= MAX_REPOS_LIMIT);
  }, [selectedExternalIds.length]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredRepositories.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
    paddingStart: 0,
    paddingEnd: 0,
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add Repositories')}</h4>
      </Header>
      <Body>
        {showMaxLimitAlert && (
          <Alert variant="info">
            {t('Seer is currently limited to %s repositories.', MAX_REPOS_LIMIT)}
          </Alert>
        )}
        <SearchContainer hasAlert={showMaxLimitAlert}>
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch size="sm" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              type="text"
              placeholder={t('Search available repositories...')}
              value={modalSearchQuery}
              onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                setModalSearchQuery(ev.target.value)
              }
              autoFocus
            />
          </InputGroup>
        </SearchContainer>
        {isFetchingRepositories ? (
          <Stack justify="center" align="center" padding="3xl" gap="xl" width="100%">
            <StyledLoadingIndicator size={36} />
            <LoadingMessage>{t('Loading repositories...')}</LoadingMessage>
          </Stack>
        ) : filteredRepositories.length === 0 ? (
          <EmptyMessage>
            {modalSearchQuery.trim() &&
            selectedExternalIds.length === filteredRepositories.length
              ? t('All available repositories have been added.')
              : t('No matching repositories found.')}
          </EmptyMessage>
        ) : (
          <ModalReposContainer ref={parentRef}>
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualItem => {
                const repo = filteredRepositories[virtualItem.index]!;
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <SelectableRepoItem
                      repo={repo}
                      isSelected={selectedExternalIds.includes(repo.externalId)}
                      onToggle={handleToggleRepository}
                    />
                  </div>
                );
              })}
            </div>
          </ModalReposContainer>
        )}
      </Body>
      <Footer>
        <Flex justify="between" align="center" width="100%">
          <div>
            {tct(
              "Don't see the repo you want? [manageRepositoriesLink:Manage repositories here.]",
              {
                manageRepositoriesLink: (
                  <Link to={`/settings/${organization.slug}/repos/`} />
                ),
              }
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const selectedRepoIds = selectedExternalIds
                .map(
                  externalId =>
                    repositories?.find(repo => repo.externalId === externalId)?.id
                )
                .filter<string>(value => value !== undefined);

              onSave({selectedExternalIds, selectedRepoIds});
              closeModal();
            }}
          >
            {selectedExternalIds.length > 0
              ? tn('Add %s Repository', 'Add %s Repositories', selectedExternalIds.length)
              : t('Done')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

const ModalReposContainer = styled('div')`
  height: 35vh;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  & > div > div {
    &:not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    }
  }
`;

const SearchContainer = styled('div')<{hasAlert: boolean}>`
  margin-top: ${p => (p.hasAlert ? p.theme.space.lg : 0)};
  margin-bottom: ${p => p.theme.space.lg};
`;

const EmptyMessage = styled('div')`
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
  text-align: center;
  font-size: ${p => p.theme.font.size.md};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;
