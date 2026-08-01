import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useReducedMotion} from 'framer-motion';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {openConfirmModal} from 'sentry/components/confirm';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingError} from 'sentry/components/loadingError';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd, IconCopy, IconDelete, IconSeer, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMembers} from 'sentry/utils/members/useMembers';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {
  archiveInvestigation,
  createInvestigation,
  duplicateInvestigation,
  investigationListQueryOptions,
  updateInvestigationFavorite,
  updatePermissions,
} from './api';
import {InvestigationAccessSelector} from './investigationAccessSelector';
import type {InvestigationListItem} from './types';

const SUGGESTIONS = [
  t('Why did checkout get slower?'),
  t('Summarize my highest priority issues'),
  t('Compare errors before and after the latest release'),
];

type InvestigationSort =
  | 'mine'
  | 'title'
  | '-title'
  | '-dateCreated'
  | 'dateCreated'
  | '-dateUpdated';

const SORT_OPTIONS: Array<{label: string; value: InvestigationSort}> = [
  {label: t('My Investigations'), value: 'mine'},
  {label: t('Investigation Name (A-Z)'), value: 'title'},
  {label: t('Investigation Name (Z-A)'), value: '-title'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
  {label: t('Recently Updated'), value: '-dateUpdated'},
];

type InvestigationColumn =
  | 'title'
  | 'cellCount'
  | 'createdBy'
  | 'permissions'
  | 'dateCreated';

const COLUMN_ORDER: Array<GridColumnOrder<InvestigationColumn>> = [
  {key: 'title', name: t('Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'cellCount', name: t('Cells'), width: COL_WIDTH_UNDEFINED},
  {key: 'createdBy', name: t('Owner'), width: COL_WIDTH_UNDEFINED},
  {key: 'permissions', name: t('Access'), width: COL_WIDTH_UNDEFINED},
  {key: 'dateCreated', name: t('Created'), width: COL_WIDTH_UNDEFINED},
];

export default function SeerNotebookLauncher() {
  const organization = useOrganization();
  if (!organization.features.includes('investigations')) {
    return (
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    );
  }

  return <SeerNotebookLauncherContent />;
}

function SeerNotebookLauncherContent() {
  const [prompt, setPrompt] = useState('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string>();
  const [sort, setSort] = useState<InvestigationSort>('mine');
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const organization = useOrganization();
  const currentUser = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {openSeerExplorer, sessionState} = useSeerExplorerContext();
  const prefersReducedMotion = useReducedMotion();
  const listOptions = investigationListQueryOptions({
    organizationSlug: organization.slug,
    cursor,
  });
  const investigationsQuery = useQuery(listOptions);
  const investigations = useMemo(
    () => investigationsQuery.data?.json ?? [],
    [investigationsQuery.data?.json]
  );
  const ownerIds = useMemo(
    () =>
      investigations.flatMap(investigation =>
        investigation.createdBy ? [investigation.createdBy] : []
      ),
    [investigations]
  );
  const {data: owners = []} = useMembers({ids: ownerIds, enabled: ownerIds.length > 0});
  const ownersById = new Map(owners.map(owner => [String(owner.id), owner]));
  const visibleInvestigations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = investigations
      .filter(investigation =>
        investigation.title.toLocaleLowerCase().includes(normalizedSearch)
      )
      .map(investigation => ({
        ...investigation,
        isFavorited: favoriteOverrides[investigation.id] ?? investigation.isFavorited,
      }));
    const compareTitle = (left: InvestigationListItem, right: InvestigationListItem) =>
      left.title.localeCompare(right.title);
    const compareDate = (
      left: InvestigationListItem,
      right: InvestigationListItem,
      field: 'dateCreated' | 'dateUpdated'
    ) => new Date(left[field]).getTime() - new Date(right[field]).getTime();

    return [...filtered].sort((left, right) => {
      if (left.isFavorited !== right.isFavorited) {
        return left.isFavorited ? -1 : 1;
      }
      if (sort === 'mine') {
        const leftIsMine = left.createdBy === String(currentUser.id);
        const rightIsMine = right.createdBy === String(currentUser.id);
        return leftIsMine === rightIsMine
          ? compareTitle(left, right)
          : leftIsMine
            ? -1
            : 1;
      }
      if (sort === 'title') {
        return compareTitle(left, right);
      }
      if (sort === '-title') {
        return compareTitle(right, left);
      }
      if (sort === 'dateCreated') {
        return compareDate(left, right, 'dateCreated');
      }
      if (sort === '-dateCreated') {
        return compareDate(right, left, 'dateCreated');
      }
      return compareDate(right, left, 'dateUpdated');
    });
  }, [currentUser.id, favoriteOverrides, investigations, search, sort]);

  const refreshInvestigations = () =>
    queryClient.invalidateQueries({queryKey: listOptions.queryKey});
  const createMutation = useMutation({
    mutationFn: () =>
      createInvestigation(organization.slug, {
        title: t('Untitled investigation'),
      }),
    onSuccess: investigation => {
      queryClient.invalidateQueries({queryKey: [listOptions.queryKey[0]]});
      navigate(`/organizations/${organization.slug}/seer/${investigation.id}/`);
    },
    onError: () => addErrorMessage(t('Unable to create the investigation.')),
  });

  const toggleFavorite = async (
    investigation: InvestigationListItem,
    shouldFavorite: boolean
  ) => {
    setFavoriteOverrides(current => ({
      ...current,
      [investigation.id]: shouldFavorite,
    }));
    try {
      await updateInvestigationFavorite(
        organization.slug,
        investigation.id,
        shouldFavorite
      );
      await refreshInvestigations();
    } catch {
      setFavoriteOverrides(current => ({
        ...current,
        [investigation.id]: investigation.isFavorited,
      }));
      addErrorMessage(t('Unable to update the investigation star.'));
    }
  };

  const renderRowActions = (investigation: InvestigationListItem) => (
    <Flex gap="xs">
      <RowAction
        size="sm"
        variant="transparent"
        icon={<IconCopy />}
        aria-label={t('Duplicate investigation')}
        onClick={event => {
          event.stopPropagation();
          openConfirmModal({
            message: t('Are you sure you want to duplicate this investigation?'),
            priority: 'primary',
            onConfirm: async () => {
              await duplicateInvestigation(organization.slug, investigation.id);
              await refreshInvestigations();
              addSuccessMessage(t('Investigation duplicated.'));
            },
          });
        }}
      />
      <RowAction
        size="sm"
        variant="transparent"
        icon={<IconDelete />}
        aria-label={t('Delete investigation')}
        disabled={!investigation.permissions.canManage}
        tooltipProps={{
          title: investigation.permissions.canManage
            ? undefined
            : t(
                'Only the creator or an organization manager can delete this investigation.'
              ),
        }}
        onClick={event => {
          event.stopPropagation();
          openConfirmModal({
            message: t('Are you sure you want to delete this investigation?'),
            priority: 'danger',
            onConfirm: async () => {
              await archiveInvestigation(
                organization.slug,
                investigation.id,
                investigation.version
              );
              await refreshInvestigations();
              addSuccessMessage(t('Investigation deleted.'));
            },
          });
        }}
      />
    </Flex>
  );

  const renderBodyCell = (
    column: GridColumnOrder<InvestigationColumn>,
    investigation: InvestigationListItem
  ) => {
    if (column.key === 'title') {
      return (
        <Text ellipsis variant="accent">
          <Link to={`/organizations/${organization.slug}/seer/${investigation.id}/`}>
            {investigation.title}
          </Link>
        </Text>
      );
    }
    if (column.key === 'cellCount') {
      return investigation.cellCount;
    }
    if (column.key === 'createdBy') {
      const owner = investigation.createdBy
        ? ownersById.get(investigation.createdBy)
        : undefined;
      return owner ? <UserAvatar hasTooltip user={owner} size={26} /> : '—';
    }
    if (column.key === 'permissions') {
      return (
        <InvestigationAccessSelector
          permissions={investigation.permissions}
          onChange={async permissions => {
            await updatePermissions(organization.slug, investigation.id, {
              investigationVersion: investigation.version,
              isEditableByEveryone: permissions.isEditableByEveryone,
              teamIds: permissions.teamIds,
            });
            await refreshInvestigations();
            addSuccessMessage(t('Investigation edit access updated.'));
          }}
        />
      );
    }
    return (
      <Flex align="center" justify="between" gap="3xl">
        <TimeSince date={investigation.dateCreated} />
        {renderRowActions(investigation)}
      </Flex>
    );
  };

  return (
    <SentryDocumentTitle title={t('Seer')}>
      <Page>
        <Hero>
          <HeroContent>
            <BrandLockup>
              <HeroSeerIcon aria-label={t('Seer')} />
              <Stack gap="sm">
                <Title>{t('Start with a question')}</Title>
                <Subtitle>
                  {t(
                    'Ask Seer about your application, follow the evidence, and keep what you find in one place.'
                  )}
                </Subtitle>
              </Stack>
            </BrandLockup>

            <PromptForm
              onSubmit={event => {
                event.preventDefault();
                const query = prompt.trim();
                if (query) {
                  openSeerExplorer({initialQuery: query, startNewRun: true});
                }
              }}
            >
              <PromptInput
                aria-label={t('Ask Seer')}
                placeholder={t('What would you like to investigate?')}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
              />
              <PromptSubmit
                variant="primary"
                aria-label={
                  sessionState === 'thinking' ? t('Seer is thinking...') : t('Ask Seer')
                }
                icon={
                  <IconSeer
                    animation={sessionState === 'thinking' ? 'loading' : undefined}
                  />
                }
                disabled={!prompt.trim()}
                type="submit"
              >
                <Flex position="relative">
                  <span
                    style={{
                      visibility: sessionState === 'thinking' ? 'hidden' : undefined,
                    }}
                  >
                    {t('Ask Seer')}
                  </span>
                  {sessionState === 'thinking' ? (
                    <ButtonLoader>
                      {prefersReducedMotion ? (
                        <Text variant="primary">{t('Thinking...')}</Text>
                      ) : (
                        <IndeterminateLoader variant="monochrome" />
                      )}
                    </ButtonLoader>
                  ) : null}
                </Flex>
              </PromptSubmit>
            </PromptForm>

            <Suggestions aria-label={t('Suggested prompts')}>
              {SUGGESTIONS.map(suggestion => (
                <Suggestion
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                >
                  {suggestion}
                </Suggestion>
              ))}
            </Suggestions>
          </HeroContent>
        </Hero>

        <InvestigationSection>
          <Toolbar>
            <SearchBar
              defaultQuery=""
              query={search}
              placeholder={t('Search Investigations')}
              onChange={setSearch}
            />
            <CompactSelect
              value={sort}
              options={SORT_OPTIONS}
              onChange={option => setSort(option.value)}
              position="bottom-end"
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} prefix={t('Sort By')} />
              )}
            />
            <Button
              variant="primary"
              icon={<IconAdd />}
              busy={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {t('New Investigation')}
            </Button>
          </Toolbar>

          {investigationsQuery.isError ? (
            <LoadingError onRetry={() => investigationsQuery.refetch()} />
          ) : (
            <GridEditable
              data={visibleInvestigations}
              columnOrder={COLUMN_ORDER}
              columnSortBy={[]}
              grid={{
                renderBodyCell,
                renderHeadCell: column => column.name,
                renderPrependColumns: (
                  isHeader: boolean,
                  investigation?: InvestigationListItem
                ) => {
                  if (isHeader) {
                    return [
                      <IconStar
                        key="favorite-header"
                        variant="warning"
                        isSolid
                        aria-label={t('Star column')}
                      />,
                    ];
                  }
                  if (!investigation) {
                    return [];
                  }
                  return [
                    <Button
                      key={investigation.id}
                      size="zero"
                      variant="transparent"
                      aria-label={
                        investigation.isFavorited
                          ? t('Unstar investigation')
                          : t('Star investigation')
                      }
                      icon={
                        <IconStar
                          size="sm"
                          variant={investigation.isFavorited ? 'warning' : 'muted'}
                          isSolid={investigation.isFavorited}
                        />
                      }
                      onClick={() =>
                        toggleFavorite(investigation, !investigation.isFavorited)
                      }
                    />,
                  ];
                },
                prependColumnWidths: ['max-content'],
              }}
              isLoading={investigationsQuery.isPending}
              emptyMessage={
                <EmptyStateWarning>
                  <p>{t('Sorry, no Investigations match your filters.')}</p>
                </EmptyStateWarning>
              }
            />
          )}
          <Pagination
            pageLinks={investigationsQuery.data?.headers.Link}
            onCursor={nextCursor => setCursor(nextCursor)}
          />
        </InvestigationSection>
      </Page>
    </SentryDocumentTitle>
  );
}

const Page = styled('div')`
  min-height: 100%;
  background: ${p => p.theme.tokens.background.primary};
`;

const Hero = styled('section')`
  --isometric-dot: color-mix(
    in srgb,
    ${p => p.theme.tokens.border.primary} 40%,
    transparent
  );

  position: relative;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background-image:
    radial-gradient(circle, var(--isometric-dot) 1px, transparent 1.25px),
    radial-gradient(circle, var(--isometric-dot) 1px, transparent 1.25px);
  background-position:
    0 0,
    14px 8px;
  background-size: 28px 16px;
  background-color: ${p => p.theme.tokens.background.secondary};
`;

const HeroContent = styled('div')`
  display: flex;
  width: min(960px, calc(100% - 48px));
  align-items: center;
  margin: 0 auto;
  padding: 56px 0 52px;
  flex-direction: column;

  @media (max-width: 600px) {
    width: calc(100% - 32px);
    padding: 42px 0 38px;
  }
`;

const BrandLockup = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.lg};
  text-align: center;
`;

const HeroSeerIcon = styled(IconSeer)`
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  color: ${p => p.theme.tokens.content.primary};
`;

const Title = styled('h1')`
  margin: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.02em;
`;

const Subtitle = styled('p')`
  max-width: 660px;
  margin: 0 auto;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
`;

const PromptForm = styled('form')`
  display: grid;
  width: 100%;
  max-width: 760px;
  grid-template-columns: 1fr auto;
  gap: ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space['3xl']};
  padding: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: color-mix(
    in srgb,
    ${p => p.theme.tokens.background.primary} 44%,
    ${p => p.theme.tokens.background.secondary}
  );
  box-shadow: ${p => p.theme.shadow.low};

  &:focus-within {
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    box-shadow:
      0 0 0 1px ${p => p.theme.tokens.focus.default},
      ${p => p.theme.shadow.low};
  }
`;

const PromptInput = styled('textarea')`
  min-height: 74px;
  resize: none;
  border: 0;
  outline: 0;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  background: transparent;
  color: ${p => p.theme.tokens.content.primary};
  font-family: inherit;
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;

  &::placeholder {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const PromptSubmit = styled(Button)`
  align-self: end;

  > span:last-child {
    overflow: visible;
  }
`;

const ButtonLoader = styled(Flex)`
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const Suggestions = styled('div')`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.xs};
  margin-top: ${p => p.theme.space.md};
`;

const Suggestion = styled('button')`
  appearance: none;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 999px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  background: color-mix(
    in srgb,
    ${p => p.theme.tokens.background.primary} 42%,
    transparent
  );
  color: ${p => p.theme.tokens.content.secondary};
  cursor: pointer;
  font: inherit;
  font-size: ${p => p.theme.font.size.xs};

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    background: ${p => p.theme.tokens.background.primary};
    color: ${p => p.theme.tokens.content.primary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 2px;
  }
`;

const InvestigationSection = styled('section')`
  box-sizing: border-box;
  width: 100%;
  padding: 32px 32px 64px;

  @media (max-width: 600px) {
    padding: 24px 16px 48px;
  }
`;

const Toolbar = styled('div')`
  display: grid;
  grid-template-columns: minmax(240px, 1fr) max-content max-content;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const RowAction = styled(Button)`
  border: 0;
  box-shadow: none;
`;
