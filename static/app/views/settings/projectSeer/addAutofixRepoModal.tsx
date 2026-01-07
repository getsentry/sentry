import {Fragment, useCallback, useMemo, useRef, useState, type ChangeEvent} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Link} from 'sentry/components/core/link';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {MAX_REPOS_LIMIT} from 'sentry/views/settings/projectSeer/constants';

import {SelectableRepoItem} from './selectableRepoItem';

type Props = ModalRenderProps & {
  /**
   * Callback function triggered when the modal is saved.
   */
  onSave: (repoIds: string[]) => void;
  /**
   * Repositories currently selected for Autofix in the parent component.
   */
  selectedRepoIds: string[];
};

export function AddAutofixRepoModal({
  selectedRepoIds,
  onSave,
  Header,
  Body,
  Footer,
  closeModal,
}: Props) {
  const {data: repositories, isFetching: isFetchingRepositories} =
    useOrganizationRepositories();

  const organization = useOrganization();
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [showMaxLimitAlert, setShowMaxLimitAlert] = useState(false);
  const [modalSelectedRepoIds, setModalSelectedRepoIds] =
    useState<string[]>(selectedRepoIds);

  const newModalSelectedRepoIds = modalSelectedRepoIds.filter(
    id => !selectedRepoIds.includes(id)
  );

  const unselectedRepositories = useMemo(() => {
    if (!repositories) {
      return [];
    }
    return repositories.filter(repo => !selectedRepoIds.includes(repo.externalId));
  }, [repositories, selectedRepoIds]);

  const filteredModalRepositories = useMemo(() => {
    let filtered = unselectedRepositories;
    if (modalSearchQuery.trim()) {
      const query = modalSearchQuery.toLowerCase();
      filtered = unselectedRepositories.filter(repo =>
        repo.name.toLowerCase().includes(query)
      );
    }

    return filtered.filter(repo => repo.provider?.id && repo.provider.id !== 'unknown');
  }, [unselectedRepositories, modalSearchQuery]);

  const handleToggleRepository = useCallback((repoId: string) => {
    setModalSelectedRepoIds(prev => {
      if (prev.includes(repoId)) {
        setShowMaxLimitAlert(false);
        return prev.filter(id => id !== repoId);
      }
      if (prev.length >= MAX_REPOS_LIMIT) {
        setShowMaxLimitAlert(true);
        return prev;
      }
      setShowMaxLimitAlert(false);
      return [...prev, repoId];
    });
  }, []);

  // Virtualizer setup (simplified based on docs)
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredModalRepositories.length,
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
          <LoadingContainer>
            <StyledLoadingIndicator size={36} />
            <LoadingMessage>{t('Loading repositories...')}</LoadingMessage>
          </LoadingContainer>
        ) : filteredModalRepositories.length === 0 ? (
          <EmptyMessage>
            {modalSearchQuery.trim() && unselectedRepositories.length > 0
              ? t('No matching repositories found.')
              : t('All available repositories have been added.')}
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
                const repo = filteredModalRepositories[virtualItem.index]!;
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
                      isSelected={modalSelectedRepoIds.includes(repo.externalId)}
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
        <FooterRow>
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
            priority="primary"
            onClick={() => {
              onSave(modalSelectedRepoIds);
              closeModal();
            }}
          >
            {newModalSelectedRepoIds.length > 0
              ? tn(
                  'Add %s Repository',
                  'Add %s Repositories',
                  newModalSelectedRepoIds.length
                )
              : t('Done')}
          </Button>
        </FooterRow>
      </Footer>
    </Fragment>
  );
}

const FooterRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const ModalReposContainer = styled('div')`
  height: 35vh;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};

  & > div > div {
    &:not(:last-child) {
      border-bottom: 1px solid ${p => p.theme.border};
    }
  }
`;

const SearchContainer = styled('div')<{hasAlert: boolean}>`
  margin-top: ${p => (p.hasAlert ? space(1.5) : 0)};
  margin-bottom: ${space(1.5)};
`;

const EmptyMessage = styled('div')`
  padding: ${space(2)};
  color: ${p => p.theme.subText};
  text-align: center;
  font-size: ${p => p.theme.fontSize.md};
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
  font-size: ${p => p.theme.fontSize.md};
`;
