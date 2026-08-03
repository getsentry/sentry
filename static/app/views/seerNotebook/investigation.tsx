import {
  Fragment,
  memo,
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useParams} from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';
import {useQueryClient} from '@tanstack/react-query';
import {observer} from 'mobx-react-lite';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {openConfirmModal} from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {LoadingError} from 'sentry/components/loadingError';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_RELEASES_SORT} from 'sentry/constants/releases';
import {
  IconAdd,
  IconClock,
  IconCode,
  IconDelete,
  IconMarkdown,
  IconPlay,
  IconSettings,
  IconStar,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SortableReleasesSelect} from 'sentry/views/dashboards/sortableReleasesSelect';
import {DashboardFilterKeys} from 'sentry/views/dashboards/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import {
  NotebookStoreProvider,
  useNotebookStore,
} from 'sentry/views/seerNotebook/stores/storeContext';
import {QueryClientInvestigationTransport} from 'sentry/views/seerNotebook/stores/transport';

import {setCellReaction} from './api';
import {CellComments} from './comments';
import {PersistedCellOutput, TextCellExecutionOutput} from './output';
import {InvestigationParameters} from './parameters';
import {InvestigationSettings} from './settings';
import type {
  InvestigationCell,
  InvestigationCellKind,
  InvestigationDetail,
  InvestigationDisplay,
  InvestigationFilters,
  InvestigationPermissions,
  InvestigationReaction,
  InvestigationReactionName,
} from './types';
import {INVESTIGATION_REACTIONS} from './types';

type SeerInvestigationProps = {
  onCellListRender?: ProfilerOnRenderCallback;
};

export default function SeerInvestigation() {
  return <SeerInvestigationView />;
}

export function SeerInvestigationPerformanceHarness(props: SeerInvestigationProps) {
  return <SeerInvestigationView {...props} />;
}

function SeerInvestigationView({onCellListRender}: SeerInvestigationProps) {
  const organization = useOrganization();
  if (!organization.features.includes('investigations')) {
    return (
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    );
  }
  return <SeerInvestigationContent onCellListRender={onCellListRender} />;
}

function SeerInvestigationContent({onCellListRender}: SeerInvestigationProps) {
  const {investigationId} = useParams<{investigationId: string}>();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [store] = useState(
    () =>
      new NotebookStore({
        idGenerator: uuid4,
        investigationId: investigationId ?? 'missing',
        organizationSlug: organization.slug,
        queryExecutionEnabled: organization.features.includes(
          'investigations-query-execution'
        ),
        transport: new QueryClientInvestigationTransport(
          queryClient,
          organization.slug,
          investigationId ?? 'missing'
        ),
      })
  );

  useEffect(() => {
    void store.load();
    return () => store.dispose();
  }, [store]);

  if (!investigationId) {
    return <LoadingError message={t('No investigation was selected.')} />;
  }

  return (
    <NotebookStoreProvider store={store}>
      <InvestigationEditor onCellListRender={onCellListRender} />
    </NotebookStoreProvider>
  );
}

const InvestigationEditor = observer(function InvestigationEditor({
  onCellListRender,
}: SeerInvestigationProps) {
  const store = useNotebookStore();
  const organization = useOrganization();
  const {openModal} = useModal();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 6}})
  );

  if (store.loadState === 'error') {
    return <LoadingError onRetry={() => store.retryLoad()} />;
  }
  if (store.loadState !== 'ready') {
    return <LoadingState>{t('Loading investigation…')}</LoadingState>;
  }

  const detail = store.detail;
  const readOnly = store.isReadOnly;

  const commitTitle = () => {
    setIsEditingTitle(false);
    void store
      .commitTitle()
      .catch(() => addErrorMessage(t('The investigation change could not be saved.')));
  };

  const saveMetadata = (values: {
    filters?: Partial<InvestigationFilters>;
    projectIds?: number[];
  }) => store.saveMetadata(values);

  const toggleFavorite = async () => {
    try {
      await store.toggleFavorite();
    } catch {
      addErrorMessage(t('The investigation favorite could not be updated.'));
    }
  };

  const openSettings = () => {
    openModal(
      modalProps => (
        <InvestigationSettingsModal
          {...modalProps}
          detail={detail}
          onSavePermissions={permissions => store.updateAccess(permissions)}
          onArchive={() => {
            openConfirmModal({
              message: t('Archive this investigation? It will become read-only.'),
              confirmText: t('Archive'),
              priority: 'danger',
              onConfirm: () => store.archive(),
            });
          }}
          onRestore={() => store.restoreInvestigation()}
        />
      ),
      {
        modalCss: css`
          width: min(600px, 90vw);
        `,
      }
    );
  };

  const openHistory = () => {
    openModal(
      modalProps => <InvestigationHistoryModal {...modalProps} detail={detail} />,
      {
        modalCss: css`
          width: min(600px, 90vw);
        `,
      }
    );
  };

  const editor = (
    <EditorPage>
      {store.conflict ? (
        <Alert.Container>
          <Alert
            variant="warning"
            trailingItems={
              <Flex gap="sm">
                <Alert.Button onClick={() => void store.reloadLatest()}>
                  {t('Reload latest')}
                </Alert.Button>
                <Alert.Button onClick={() => void store.retryChange()} variant="primary">
                  {t('Retry my change')}
                </Alert.Button>
              </Flex>
            }
          >
            {t('This investigation changed elsewhere. Your local draft is still here.')}
          </Alert>
        </Alert.Container>
      ) : null}
      <NotebookControls>
        <FilterControls>
          <PageFilterBar condensed>
            <ProjectPageFilter
              disabled={readOnly}
              onChange={projectIds => saveMetadata({projectIds})}
            />
            <EnvironmentPageFilter
              disabled={readOnly}
              onChange={environments => saveMetadata({filters: {environments}})}
            />
            <DatePageFilter
              disabled={readOnly}
              onChange={({relative, start, end, utc}) =>
                saveMetadata({
                  filters: {
                    datetime: {
                      period: relative ?? undefined,
                      start: start?.toISOString(),
                      end: end?.toISOString(),
                      utc: utc ?? undefined,
                    },
                  },
                })
              }
            />
          </PageFilterBar>
          <SortableReleasesSelect
            sortBy={DEFAULT_RELEASES_SORT}
            selectedReleases={detail.filters.releases ?? []}
            isDisabled={readOnly}
            handleChangeFilter={filters =>
              saveMetadata({
                filters: {
                  releases: filters[DashboardFilterKeys.RELEASE] ?? [],
                },
              })
            }
          />
          <InvestigationParameters
            parameters={detail.parameters}
            disabled={readOnly}
            onSave={values => store.updateParameterValues(values)}
          />
        </FilterControls>
        <CompactSelect
          value={detail.filters.interval ?? '10m'}
          disabled={readOnly}
          onChange={option => saveMetadata({filters: {interval: option.value}})}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} icon={<IconClock />} />
          )}
          menuTitle={t('Interval')}
          options={[
            {value: '5m', label: t('5 minutes')},
            {value: '10m', label: t('10 minutes')},
            {value: '30m', label: t('30 minutes')},
            {value: '1h', label: t('1 hour')},
          ]}
        />
      </NotebookControls>
      <NotebookContent>
        <NotebookHeading>
          {isEditingTitle ? (
            <NotebookTitleInput
              autoFocus
              aria-label={t('Investigation name')}
              value={store.titleDraft}
              onChange={event => store.editTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitTitle();
                } else if (event.key === 'Escape') {
                  store.cancelTitleEdit();
                  setIsEditingTitle(false);
                }
              }}
            />
          ) : (
            <NotebookTitleButton
              type="button"
              disabled={readOnly}
              aria-label={t('Edit investigation name')}
              onClick={() => {
                store.editTitle(detail.title);
                setIsEditingTitle(true);
              }}
            >
              {detail.title}
            </NotebookTitleButton>
          )}
          <Flex align="center" gap="sm" wrap="wrap">
            <Badge variant={detail.status === 'active' ? 'success' : 'muted'}>
              {detail.status === 'active' ? t('Active') : t('Archived')}
            </Badge>
            <InvestigationSavingStatus store={store} />
            {detail.permissions.canEdit ? null : (
              <Badge variant="muted">{t('View only')}</Badge>
            )}
          </Flex>
        </NotebookHeading>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            if (readOnly || !event.over || event.active.id === event.over.id) {
              return;
            }
            void store
              .moveCell(String(event.active.id), String(event.over.id))
              .catch(() =>
                addErrorMessage(t('The investigation change could not be saved.'))
              );
          }}
        >
          <SortableContext items={store.cellKeys} strategy={verticalListSortingStrategy}>
            <OptionalProfiler id="investigation-cell-list" onRender={onCellListRender}>
              <CellList>
                {store.cellsInOrder.map((cellStore, index) => (
                  <Fragment key={cellStore.clientKey}>
                    {index > 0 && !readOnly ? (
                      <MemoizedCellInsertDivider
                        index={index}
                        onInsert={(kind, insertIndex) =>
                          store.insertCell(kind, insertIndex)
                        }
                      />
                    ) : null}
                    <MemoizedSortableCell
                      cell={cellStore.toInvestigationCell()}
                      index={index}
                      disabled={readOnly}
                      collaborationDisabled={detail.status === 'archived'}
                      canManage={detail.permissions.canManage}
                      investigationId={detail.id}
                      organizationSlug={organization.slug}
                      queryExecutionEnabled={store.queryExecutionEnabled}
                      onInsertAfter={kind => store.insertCell(kind, index + 1)}
                      onSave={(_currentCell, values) => {
                        cellStore.applyDraft(values);
                        return cellStore.flush();
                      }}
                      onExecute={() => cellStore.run()}
                      onDelete={() =>
                        openConfirmModal({
                          message: t('Delete this cell?'),
                          confirmText: t('Delete'),
                          priority: 'danger',
                          onConfirm: () => store.deleteCell(cellStore.clientKey),
                        })
                      }
                      onCommentCountChange={delta => cellStore.changeCommentCount(delta)}
                      onRefreshCell={() => store.refreshDetail()}
                    />
                  </Fragment>
                ))}
              </CellList>
            </OptionalProfiler>
          </SortableContext>
        </DndContext>

        {readOnly ? null : (
          <MemoizedCellInsertDivider
            index={detail.cells.length}
            isEnd
            onInsert={(kind, index) => store.insertCell(kind, index)}
          />
        )}
      </NotebookContent>
    </EditorPage>
  );

  const savedDatetime = detail.filters.datetime ?? {};

  return (
    <PageFiltersContainer
      key={`${detail.id}:filters`}
      disablePersistence
      skipLoadLastUsed
      defaultSelection={{
        projects: detail.projectIds.length ? detail.projectIds : [-1],
        environments: detail.filters.environments ?? [],
        datetime: {
          period: savedDatetime.period ?? '24h',
          start: savedDatetime.start ?? null,
          end: savedDatetime.end ?? null,
          utc: savedDatetime.utc ?? false,
        },
      }}
    >
      <SentryDocumentTitle title={detail.title}>
        <TopBar.Slot name="breadcrumbs">
          <BreadcrumbList
            items={[
              {
                type: 'link',
                label: t('Investigations'),
                to: `/organizations/${organization.slug}/seer/`,
              },
            ]}
          />
        </TopBar.Slot>
        <TopBar.Slot name="title">
          <BreadcrumbList.Title
            item={{
              type: 'page-title',
              label: detail.title,
            }}
          />
        </TopBar.Slot>
        <TopBar.Slot name="actions">
          <Tooltip title={detail.isFavorited ? t('Unstar') : t('Star')}>
            <Button
              size="sm"
              aria-label={
                detail.isFavorited ? t('Unstar investigation') : t('Star investigation')
              }
              icon={
                <IconStar
                  isSolid={detail.isFavorited}
                  variant={detail.isFavorited ? 'warning' : 'muted'}
                />
              }
              disabled={store.isUpdatingFavorite}
              onClick={toggleFavorite}
            />
          </Tooltip>
          <Tooltip title={t('Edit history')}>
            <Button
              size="sm"
              aria-label={t('Edit history')}
              icon={<IconClock />}
              onClick={openHistory}
            />
          </Tooltip>
          <Tooltip title={t('Investigation settings')}>
            <Button
              size="sm"
              aria-label={t('Investigation settings')}
              icon={<IconSettings />}
              onClick={openSettings}
            />
          </Tooltip>
        </TopBar.Slot>
        <Workspace>{editor}</Workspace>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
});

const InvestigationSavingStatus = observer(function InvestigationSavingStatus({
  store,
}: {
  store: NotebookStore;
}) {
  return (
    <Text size="sm" variant="muted">
      {store.isSaving ? t('Saving…') : t('All changes saved')}
    </Text>
  );
});

function OptionalProfiler({
  children,
  id,
  onRender,
}: {
  children: ReactNode;
  id: string;
  onRender?: ProfilerOnRenderCallback;
}) {
  return onRender ? (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  ) : (
    children
  );
}

function InvestigationSettingsModal({
  Header,
  Body,
  Footer,
  closeModal,
  detail,
  onSavePermissions,
  onArchive,
  onRestore,
}: ModalRenderProps & {
  detail: InvestigationDetail;
  onArchive: () => void;
  onRestore: () => Promise<void>;
  onSavePermissions: (permissions: InvestigationPermissions) => Promise<void>;
}) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Investigation settings')}</Heading>
      </Header>
      <Body>
        <InvestigationSettings
          detail={detail}
          onSavePermissions={onSavePermissions}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </Body>
      <Footer>
        <Button size="sm" onClick={closeModal}>
          {t('Done')}
        </Button>
      </Footer>
    </Fragment>
  );
}

function InvestigationHistoryModal({
  Header,
  Body,
  Footer,
  closeModal,
  detail,
}: ModalRenderProps & {detail: InvestigationDetail}) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Edit history')}</Heading>
      </Header>
      <Body>
        <HistoryCurrent>
          <Stack gap="xs">
            <Text bold>{t('Current version')}</Text>
            <Text size="sm" variant="muted">
              {t('Version %s', detail.version)} · <DateTime date={detail.dateUpdated} />
            </Text>
          </Stack>
          <Badge variant="success">{t('Current')}</Badge>
        </HistoryCurrent>
        <Text size="sm" variant="muted">
          {t('Earlier notebook versions will appear here as edit history is recorded.')}
        </Text>
      </Body>
      <Footer>
        <Button size="sm" onClick={closeModal}>
          {t('Done')}
        </Button>
      </Footer>
    </Fragment>
  );
}

type SortableCellProps = {
  canManage: boolean;
  cell: InvestigationCell;
  collaborationDisabled: boolean;
  disabled: boolean;
  index: number;
  investigationId: string;
  onCommentCountChange: (delta: number) => void;
  onDelete: () => void;
  onExecute: (cell: InvestigationCell) => Promise<void>;
  onInsertAfter: (kind: InvestigationCellKind) => Promise<void>;
  onRefreshCell: () => Promise<void>;
  onSave: (
    cell: InvestigationCell,
    values: {
      content: string;
      display: InvestigationDisplay;
      generationPrompt: string;
      title: string;
    }
  ) => Promise<unknown>;
  organizationSlug: string;
  queryExecutionEnabled: boolean;
};

type SortableCellState = ReturnType<typeof useSortable>;
type SortableCellPresentation = {
  dropIndicator: 'after' | 'before' | null;
  isDragActive: boolean;
};

function SortableCell(props: SortableCellProps) {
  const sortable = useSortable({
    id: getCellSortableId(props.cell),
    disabled: props.disabled,
  });
  const isDragActive = sortable.activeIndex >= 0;
  const dropIndicator =
    isDragActive &&
    sortable.overIndex === props.index &&
    sortable.activeIndex !== props.index
      ? sortable.activeIndex < props.index
        ? 'after'
        : 'before'
      : null;
  return (
    <MemoizedSortableCellContent
      {...props}
      sortable={sortable}
      isDragActive={isDragActive}
      dropIndicator={dropIndicator}
    />
  );
}

function SortableCellContent({
  cell,
  index,
  dropIndicator,
  isDragActive,
  disabled,
  collaborationDisabled,
  canManage,
  investigationId,
  organizationSlug,
  onInsertAfter,
  onSave,
  onDelete,
  onCommentCountChange,
  onRefreshCell,
  onExecute,
  queryExecutionEnabled,
  sortable,
}: SortableCellProps & SortableCellPresentation & {sortable: SortableCellState}) {
  const [draft, setDraft] = useState({
    title: cell.title,
    content: cell.content,
    generationPrompt: cell.generationPrompt,
    display: cell.display,
  });
  const saved = useRef(JSON.stringify(draft));
  const [isEditingText, setIsEditingText] = useState(!cell.content && !disabled);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommandIndex, setSlashCommandIndex] = useState(0);
  const [cellReactions, setCellReactions] = useState(cell.reactions);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isRunRequested, setIsRunRequested] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displaySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingSuggestionRef = useRef(false);
  const previousOutputStatusRef = useRef(cell.outputStatus);
  const queryIntent = draft.generationPrompt || draft.content;
  const savedQueryIntent = cell.generationPrompt || cell.content;
  const executionIntent = cell.kind === 'query' ? queryIntent : draft.generationPrompt;
  const savedExecutionIntent =
    cell.kind === 'query' ? savedQueryIntent : cell.generationPrompt;
  const executionHasChanged =
    Boolean(cell.staleAt) || executionIntent !== savedExecutionIntent;
  const isExecutionRunning = ['pending', 'running'].includes(cell.outputStatus);
  const isRunBusy = isRunRequested || isExecutionRunning;
  const runVariant = executionHasChanged
    ? 'warning'
    : cell.outputStatus === 'available'
      ? 'secondary'
      : 'primary';

  const saveDraft = useCallback(
    (values: typeof draft) => {
      const serialized = JSON.stringify(values);
      if (serialized === saved.current || disabled) {
        return Promise.resolve();
      }

      const previousSaved = saved.current;
      saved.current = serialized;
      const request = onSave(cell, values);
      request.catch(() => {
        saved.current = previousSaved;
      });
      return request;
    },
    [cell, disabled, onSave]
  );

  useEffect(() => {
    const incoming = {
      title: cell.title,
      content: cell.content,
      generationPrompt: cell.generationPrompt,
      display: cell.display,
    };
    const incomingSerialized = JSON.stringify(incoming);
    setDraft(current => {
      if (
        JSON.stringify(current) !== saved.current ||
        incomingSerialized === saved.current
      ) {
        return current;
      }
      saved.current = incomingSerialized;
      return incoming;
    });
  }, [cell.content, cell.display, cell.generationPrompt, cell.title]);

  useEffect(() => {
    const previousStatus = previousOutputStatusRef.current;
    previousOutputStatusRef.current = cell.outputStatus;
    if (
      cell.kind === 'text' &&
      ['pending', 'running'].includes(previousStatus) &&
      cell.outputStatus === 'available'
    ) {
      setIsEditingText(false);
    }
  }, [cell.kind, cell.outputStatus]);
  useEffect(
    () => () => {
      if (displaySaveTimerRef.current) {
        clearTimeout(displaySaveTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!isStreamingSuggestionRef.current) {
        saveDraft(draft);
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [draft, saveDraft]);

  useEffect(
    () => () => {
      if (suggestionTimerRef.current) {
        clearInterval(suggestionTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isEditingText) {
      return;
    }
    requestAnimationFrame(() => {
      textInputRef.current?.focus();
      const position = textInputRef.current?.value.length ?? 0;
      textInputRef.current?.setSelectionRange(position, position);
    });
  }, [isEditingText]);

  const saveOnBlur = () => {
    saveDraft(draft);
  };

  const persistDisplay = (display: InvestigationDisplay) => {
    const nextDraft = {...draft, display};
    setDraft(nextDraft);
    if (displaySaveTimerRef.current) {
      clearTimeout(displaySaveTimerRef.current);
    }
    displaySaveTimerRef.current = setTimeout(() => {
      displaySaveTimerRef.current = null;
      void saveDraft(nextDraft);
    }, 400);
  };

  const runCell = async () => {
    if (isRunBusy || !executionIntent.trim() || !queryExecutionEnabled) {
      return;
    }
    setIsRunRequested(true);
    try {
      await saveDraft(draft);
      await onExecute(cell);
    } catch {
      addErrorMessage(t('The query could not be started.'));
    } finally {
      setIsRunRequested(false);
    }
  };

  const applySlashCommand = (prefix: string) => {
    const lines = draft.content.split('\n');
    lines[lines.length - 1] = prefix;
    const nextDraft = {...draft, content: lines.join('\n')};
    setDraft(nextDraft);
    setShowSlashMenu(false);
    requestAnimationFrame(() => {
      textInputRef.current?.focus();
      const position = nextDraft.content.length;
      textInputRef.current?.setSelectionRange(position, position);
    });
  };

  const slashCommands = [
    {key: 'text', label: t('Text'), hint: t('Plain text'), prefix: ''},
    {key: 'h1', label: t('Heading 1'), hint: '#', prefix: '# '},
    {key: 'h2', label: t('Heading 2'), hint: '##', prefix: '## '},
    {key: 'h3', label: t('Heading 3'), hint: '###', prefix: '### '},
    {key: 'bullet', label: t('Bulleted list'), hint: '•', prefix: '- '},
    {key: 'number', label: t('Numbered list'), hint: '1.', prefix: '1. '},
    {key: 'quote', label: t('Quote'), hint: '>', prefix: '> '},
    {key: 'code', label: t('Code block'), hint: '```', prefix: '```\n\n```'},
    {key: 'divider', label: t('Divider'), hint: '—', prefix: '---'},
    {
      key: 'query',
      label: t('Query cell'),
      hint: t('Insert below'),
      prefix: '',
    },
  ];
  const slashQuery =
    draft.content.split('\n').at(-1)?.slice(1).trim().toLowerCase() ?? '';
  const filteredSlashCommands = slashCommands.filter(command =>
    `${command.label} ${command.key}`.toLowerCase().includes(slashQuery)
  );

  const selectSlashCommand = (command: (typeof slashCommands)[number]) => {
    if (command.key === 'query') {
      const nextDraft = {
        ...draft,
        content: draft.content.replace(/\/[^\n]*$/, ''),
      };
      setDraft(nextDraft);
      saveDraft(nextDraft);
      setShowSlashMenu(false);
      void onInsertAfter('query');
      return;
    }
    applySlashCommand(command.prefix);
  };

  const queryExample = t('Show errors over time for the selected projects');

  const streamQuerySuggestion = (suggestion: string) => {
    if (suggestionTimerRef.current) {
      clearInterval(suggestionTimerRef.current);
    }
    isStreamingSuggestionRef.current = true;
    let characterIndex = 0;
    setDraft(current => ({...current, content: ''}));
    textInputRef.current?.focus();
    suggestionTimerRef.current = setInterval(() => {
      characterIndex += 1;
      setDraft(current => ({
        ...current,
        content: suggestion.slice(0, characterIndex),
      }));
      if (characterIndex >= suggestion.length) {
        if (suggestionTimerRef.current) {
          clearInterval(suggestionTimerRef.current);
          suggestionTimerRef.current = null;
        }
        isStreamingSuggestionRef.current = false;
      }
    }, 6);
  };

  const toggleCellReaction = async (
    reaction: InvestigationReactionName,
    enabled: boolean
  ) => {
    const previous = cellReactions;
    setCellReactions(updateReaction(previous, reaction, enabled));
    try {
      await setCellReaction(
        organizationSlug,
        investigationId,
        cell.id,
        reaction,
        enabled
      );
      await onRefreshCell();
    } catch {
      setCellReactions(previous);
      addErrorMessage(t('Unable to update the reaction.'));
    }
  };

  const comments = (
    <CellComments
      cell={cell}
      disabled={collaborationDisabled}
      investigationId={investigationId}
      organizationSlug={organizationSlug}
      canManage={canManage}
      onCommentCountChange={onCommentCountChange}
    />
  );

  return (
    <CellCard
      $kind={cell.kind}
      $isDragging={sortable.isDragging}
      $dropIndicator={dropIndicator}
      ref={sortable.setNodeRef}
      style={{
        transform: sortable.transform
          ? `${CSS.Transform.toString({
              ...sortable.transform,
              scaleX: 1,
              scaleY: 1,
            })} rotate(${sortable.isDragging ? 1.5 : 0}deg)`
          : undefined,
        transition: sortable.transition,
      }}
    >
      {disabled ? null : (
        <CellDragHandle $isDragActive={isDragActive} $isDragging={sortable.isDragging}>
          <DragReorderButton {...sortable.attributes} {...sortable.listeners} size="xs" />
        </CellDragHandle>
      )}
      {cellReactions.length ? (
        <CellReactionSummary $hidden={isDragActive}>
          {cellReactions.map(reaction => {
            const definition = INVESTIGATION_REACTIONS.find(
              item => item.value === reaction.reaction
            );
            return (
              <Tooltip
                key={reaction.reaction}
                title={
                  reaction.reactedByMe
                    ? reaction.count === 1
                      ? t('You reacted with %s', definition?.label)
                      : t(
                          'You and %s others reacted with %s',
                          reaction.count - 1,
                          definition?.label
                        )
                    : t('%s people reacted with %s', reaction.count, definition?.label)
                }
              >
                <ReactionPill
                  type="button"
                  $reacted={reaction.reactedByMe}
                  disabled={collaborationDisabled}
                  aria-label={t(
                    '%s reaction, %s',
                    definition?.label ?? reaction.reaction,
                    reaction.count
                  )}
                  onClick={() =>
                    toggleCellReaction(reaction.reaction, !reaction.reactedByMe)
                  }
                >
                  {definition?.emoji} {reaction.count}
                </ReactionPill>
              </Tooltip>
            );
          })}
        </CellReactionSummary>
      ) : null}
      <CellActionsRail $hidden={isDragActive}>
        {isReactionPickerOpen && !collaborationDisabled ? (
          <InlineReactionPicker>
            {INVESTIGATION_REACTIONS.map(reaction => (
              <EmojiReactionButton
                key={reaction.value}
                type="button"
                aria-label={reaction.label}
                title={reaction.label}
                onClick={() => {
                  void toggleCellReaction(
                    reaction.value,
                    !cellReactions.find(item => item.reaction === reaction.value)
                      ?.reactedByMe
                  );
                  setIsReactionPickerOpen(false);
                }}
              >
                {reaction.emoji}
              </EmojiReactionButton>
            ))}
          </InlineReactionPicker>
        ) : (
          <Fragment>
            {comments}
            {collaborationDisabled ? null : (
              <Button
                size="xs"
                variant="transparent"
                icon={<ReactionIcon />}
                aria-label={t('Add reaction')}
                onClick={() => setIsReactionPickerOpen(true)}
              />
            )}
            {disabled ? null : (
              <Button
                size="xs"
                variant="transparent"
                icon={<IconDelete />}
                aria-label={t('Delete cell %s', index + 1)}
                onClick={onDelete}
              />
            )}
          </Fragment>
        )}
      </CellActionsRail>
      <CellSurface $kind={cell.kind} $isDragging={sortable.isDragging}>
        {cell.kind === 'text' ? (
          <Fragment>
            <QueryPromptDisclosure
              size="sm"
              expanded={!draft.display.promptCollapsed}
              onExpandedChange={expanded =>
                persistDisplay({
                  ...draft.display,
                  version: 1,
                  promptCollapsed: !expanded,
                })
              }
            >
              <Disclosure.Title
                trailingItems={
                  <QueryRunButton
                    $hidden={isDragActive}
                    size="xs"
                    variant={runVariant}
                    icon={<IconPlay size="xs" />}
                    busy={isRunBusy}
                    disabled={
                      isExecutionRunning ||
                      !draft.generationPrompt.trim() ||
                      !queryExecutionEnabled
                    }
                    onClick={() => void runCell()}
                  >
                    {isRunBusy ? t('Running') : t('Generate')}
                  </QueryRunButton>
                }
              >
                <QuerySummary size="sm">
                  {draft.display.promptCollapsed
                    ? draft.generationPrompt || t('Text generation prompt')
                    : t('Text generation prompt')}
                </QuerySummary>
              </Disclosure.Title>
              <QueryPromptContent>
                <QueryEditorWrap>
                  <CellInput
                    $kind="query"
                    aria-label={t('Text generation prompt %s', index + 1)}
                    autosize
                    rows={2}
                    maxRows={18}
                    disabled={disabled}
                    placeholder={t('Describe the Markdown you want the agent to write')}
                    value={draft.generationPrompt}
                    onChange={event =>
                      setDraft(current => ({
                        ...current,
                        generationPrompt: event.target.value,
                      }))
                    }
                    onBlur={saveOnBlur}
                  />
                  {cell.dependencies.length ? (
                    <ContextHint size="xs" variant="muted">
                      {t('Uses %s linked cell(s) as context.', cell.dependencies.length)}
                    </ContextHint>
                  ) : null}
                </QueryEditorWrap>
              </QueryPromptContent>
            </QueryPromptDisclosure>
            <TextCellExecutionOutput
              canRetry={!disabled && queryExecutionEnabled && !isRunBusy}
              cell={{...cell, display: draft.display}}
              onRetry={runCell}
            />
            <TextCellBody>
              {isEditingText ? (
                <TextEditorWrap>
                  <CellInput
                    ref={textInputRef}
                    $kind="text"
                    aria-label={t('Text cell %s', index + 1)}
                    autosize
                    autoFocus={!draft.content}
                    rows={Math.max(2, draft.content.split('\n').length)}
                    maxRows={24}
                    placeholder={t("Type '/' for commands")}
                    value={draft.content}
                    onChange={event => {
                      const content = event.target.value;
                      const nextShowSlashMenu =
                        content.split('\n').at(-1)?.startsWith('/') ?? false;
                      setDraft(current => ({...current, content}));
                      if (showSlashMenu !== nextShowSlashMenu) {
                        setShowSlashMenu(nextShowSlashMenu);
                      }
                      if (nextShowSlashMenu && slashCommandIndex !== 0) {
                        setSlashCommandIndex(0);
                      }
                    }}
                    onKeyDown={event => {
                      if (!showSlashMenu || !filteredSlashCommands.length) {
                        return;
                      }
                      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        const direction = event.key === 'ArrowDown' ? 1 : -1;
                        setSlashCommandIndex(
                          current =>
                            (current + direction + filteredSlashCommands.length) %
                            filteredSlashCommands.length
                        );
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        selectSlashCommand(
                          filteredSlashCommands[
                            Math.min(slashCommandIndex, filteredSlashCommands.length - 1)
                          ]!
                        );
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        setShowSlashMenu(false);
                      }
                    }}
                    onBlur={event => {
                      if (slashMenuRef.current?.contains(event.relatedTarget)) {
                        return;
                      }
                      saveOnBlur();
                      if (draft.content) {
                        setIsEditingText(false);
                      }
                      setShowSlashMenu(false);
                    }}
                  />
                  {showSlashMenu ? (
                    <SlashCommandMenu ref={slashMenuRef} role="listbox">
                      {filteredSlashCommands.map((command, commandIndex) => (
                        <SlashCommandButton
                          key={command.key}
                          type="button"
                          role="option"
                          aria-selected={commandIndex === slashCommandIndex}
                          $selected={commandIndex === slashCommandIndex}
                          onPointerMove={() => setSlashCommandIndex(commandIndex)}
                          onClick={() => selectSlashCommand(command)}
                        >
                          <Text>{command.label}</Text>
                          <Text size="xs" variant="muted">
                            {command.hint}
                          </Text>
                        </SlashCommandButton>
                      ))}
                      {filteredSlashCommands.length ? null : (
                        <SlashCommandEmpty>
                          <Text size="sm" variant="muted">
                            {t('No matching blocks')}
                          </Text>
                        </SlashCommandEmpty>
                      )}
                    </SlashCommandMenu>
                  ) : null}
                </TextEditorWrap>
              ) : (
                <RenderedMarkdown
                  role={disabled ? undefined : 'button'}
                  tabIndex={disabled ? undefined : 0}
                  onClick={() => !disabled && setIsEditingText(true)}
                  onKeyDown={event => {
                    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      setIsEditingText(true);
                    }
                  }}
                >
                  <Markdown raw={draft.content} />
                </RenderedMarkdown>
              )}
            </TextCellBody>
          </Fragment>
        ) : (
          <Fragment>
            <QueryPromptDisclosure
              size="sm"
              expanded={!draft.display.queryCollapsed}
              onExpandedChange={expanded =>
                persistDisplay({
                  ...draft.display,
                  version: 1,
                  queryCollapsed: !expanded,
                })
              }
            >
              <Disclosure.Title
                trailingItems={
                  <QueryRunButton
                    $hidden={isDragActive}
                    size="xs"
                    variant={runVariant}
                    icon={<IconPlay size="xs" />}
                    busy={isRunBusy}
                    disabled={
                      isExecutionRunning || !queryIntent.trim() || !queryExecutionEnabled
                    }
                    onClick={() => void runCell()}
                  >
                    {isRunBusy ? t('Running') : t('Run')}
                  </QueryRunButton>
                }
              >
                <QuerySummary size="sm">
                  {draft.display.queryCollapsed
                    ? queryIntent || t('Natural language query')
                    : t('Natural language query')}
                </QuerySummary>
              </Disclosure.Title>
              <QueryPromptContent>
                <QueryEditorWrap>
                  <CellInput
                    ref={textInputRef}
                    $kind="query"
                    aria-label={t('Query cell %s', index + 1)}
                    autosize
                    rows={2}
                    maxRows={18}
                    disabled={disabled}
                    placeholder=""
                    value={queryIntent}
                    onChange={event => {
                      if (suggestionTimerRef.current) {
                        clearInterval(suggestionTimerRef.current);
                        suggestionTimerRef.current = null;
                        isStreamingSuggestionRef.current = false;
                      }
                      setDraft(current => ({
                        ...current,
                        content: '',
                        generationPrompt: event.target.value,
                      }));
                    }}
                    onBlur={saveOnBlur}
                  />
                  {queryIntent ? null : (
                    <QueryPlaceholder>
                      <Text variant="muted">
                        {t('Describe what you want to see, or ')}
                        {disabled ? (
                          t('see an example')
                        ) : (
                          <QueryExampleButton
                            type="button"
                            onClick={() => streamQuerySuggestion(queryExample)}
                          >
                            {t('see an example')}
                          </QueryExampleButton>
                        )}
                      </Text>
                    </QueryPlaceholder>
                  )}
                </QueryEditorWrap>
              </QueryPromptContent>
            </QueryPromptDisclosure>
            <PersistedCellOutput
              canRetry={!disabled && queryExecutionEnabled && !isRunBusy}
              cell={{...cell, display: draft.display}}
              currentIntent={queryIntent}
              disabled={disabled}
              investigationId={investigationId}
              organizationSlug={organizationSlug}
              onDisplayChange={persistDisplay}
              onRetry={runCell}
              onRevisedQueryIntent={async intent => {
                const nextDraft = {...draft, content: '', generationPrompt: intent};
                setDraft(nextDraft);
                await saveDraft(nextDraft);
                await onExecute(cell);
              }}
            />
          </Fragment>
        )}
      </CellSurface>
    </CellCard>
  );
}

function areSortableCellPropsEqual(previous: SortableCellProps, next: SortableCellProps) {
  return (
    previous.cell === next.cell &&
    previous.index === next.index &&
    previous.disabled === next.disabled &&
    previous.collaborationDisabled === next.collaborationDisabled &&
    previous.canManage === next.canManage &&
    previous.investigationId === next.investigationId &&
    previous.organizationSlug === next.organizationSlug &&
    previous.queryExecutionEnabled === next.queryExecutionEnabled
  );
}

const MemoizedSortableCellContent = memo(
  SortableCellContent,
  (previous, next) =>
    areSortableCellPropsEqual(previous, next) &&
    previous.dropIndicator === next.dropIndicator &&
    previous.isDragActive === next.isDragActive &&
    previous.sortable.isDragging === next.sortable.isDragging &&
    previous.sortable.transition === next.sortable.transition &&
    previous.sortable.transform?.x === next.sortable.transform?.x &&
    previous.sortable.transform?.y === next.sortable.transform?.y &&
    previous.sortable.transform?.scaleX === next.sortable.transform?.scaleX &&
    previous.sortable.transform?.scaleY === next.sortable.transform?.scaleY
);

const MemoizedSortableCell = memo(SortableCell, areSortableCellPropsEqual);

function CellTypeMenu({
  isOpen,
  onOpenChange,
  onInsert,
  trigger,
}: {
  onInsert: (kind: InvestigationCellKind) => Promise<void>;
  trigger: DropdownMenuProps['trigger'];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  return (
    <DropdownMenu
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      items={[
        {
          key: 'text',
          label: t('Text'),
          leadingItems: <IconMarkdown />,
          onAction: () => onInsert('text'),
        },
        {
          key: 'query',
          label: t('Query'),
          leadingItems: <IconCode />,
          onAction: () => onInsert('query'),
        },
      ]}
      position="bottom"
      trigger={trigger}
    />
  );
}

function updateReaction(
  reactions: InvestigationReaction[],
  name: InvestigationReactionName,
  enabled: boolean
): InvestigationReaction[] {
  const existing = reactions.find(reaction => reaction.reaction === name);
  if (!existing) {
    return enabled
      ? [...reactions, {reaction: name, count: 1, reactedByMe: true}]
      : reactions;
  }
  const count = Math.max(0, existing.count + (enabled ? 1 : -1));
  return reactions
    .map(reaction =>
      reaction.reaction === name ? {...reaction, count, reactedByMe: enabled} : reaction
    )
    .filter(reaction => reaction.count > 0);
}

function getCellSortableId(cell: InvestigationCell) {
  return typeof cell.config.optimisticKey === 'string'
    ? cell.config.optimisticKey
    : cell.id;
}

function ReactionIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 9.25C5.75 10.42 6.75 11 8 11C9.25 11 10.25 10.42 11 9.25M5.5 6.5H5.51M10.5 6.5H10.51"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CellInsertDivider({
  index,
  isEnd = false,
  onInsert,
}: {
  index: number;
  onInsert: (kind: InvestigationCellKind, index: number) => Promise<void>;
  isEnd?: boolean;
}) {
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const label = isEnd ? t('Add cell') : t('Add cell here');
  const openMenu = () => {
    setIsMenuReady(true);
    setIsMenuOpen(true);
  };

  return (
    <InsertDivider>
      {isMenuReady ? (
        <CellTypeMenu
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          onInsert={kind => onInsert(kind, index)}
          trigger={triggerProps => (
            <InsertButton
              {...triggerProps}
              size="xs"
              variant="secondary"
              icon={<IconAdd />}
              aria-label={label}
            />
          )}
        />
      ) : (
        <InsertPlaceholderButton
          type="button"
          aria-label={label}
          onClick={openMenu}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openMenu();
            }
          }}
        >
          <IconAdd size="xs" />
        </InsertPlaceholderButton>
      )}
    </InsertDivider>
  );
}

const MemoizedCellInsertDivider = memo(
  CellInsertDivider,
  (previous, next) => previous.index === next.index && previous.isEnd === next.isEnd
);

const Workspace = styled(Flex)`
  width: 100%;
  min-height: calc(100dvh - var(--top-bar-height, 53px));
  background: ${p => p.theme.tokens.background.primary};
`;

const LoadingState = styled(Text)`
  display: block;
  padding: ${p => p.theme.space['3xl']};
`;

const EditorPage = styled('section')`
  box-sizing: border-box;
  width: 100%;
  max-width: 980px;
  min-height: calc(100dvh - var(--top-bar-height, 53px));
  margin: 0 auto;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  background: ${p => p.theme.tokens.background.primary};
`;

const NotebookContent = styled('div')`
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding-top: ${p => p.theme.space.md};
`;

const NotebookControls = styled('div')`
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const NotebookHeading = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${p => p.theme.space.sm};
  flex-direction: column;
  margin-bottom: ${p => p.theme.space['2xl']};

  h1 {
    margin: 0;
    font-size: 28px;
  }
`;

const NotebookTitleButton = styled('button')`
  padding: 0;
  border: 0;
  background: transparent;
  color: ${p => p.theme.tokens.content.primary};
  cursor: text;
  font-size: 28px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.2;
  text-align: left;

  &:disabled {
    cursor: default;
  }
`;

const NotebookTitleInput = styled('input')`
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${p => p.theme.tokens.content.primary};
  font-size: 28px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.2;

  &:focus {
    outline: none;
  }
`;

const FilterControls = styled('div')`
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: ${p => p.theme.space.md};
  flex: 1;
  flex-wrap: wrap;
`;

const HistoryCurrent = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.lg};
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const CellList = styled(Stack)`
  width: 100%;
`;

const CellCard = styled('article')<{
  $dropIndicator: 'after' | 'before' | null;
  $isDragging: boolean;
  $kind: InvestigationCellKind;
}>`
  position: relative;
  z-index: ${p => (p.$isDragging ? 3 : 'auto')};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p =>
    p.$isDragging
      ? p.$kind === 'text'
        ? p.theme.shadow.low
        : p.theme.shadow.medium
      : 'none'};

  &::after {
    position: absolute;
    z-index: 5;
    right: 0;
    left: 0;
    ${p =>
      p.$dropIndicator === 'before'
        ? 'top: -18px;'
        : p.$dropIndicator === 'after'
          ? 'bottom: -18px;'
          : 'display: none;'}
    height: 3px;
    border-radius: 999px;
    background: ${p => p.theme.tokens.background.accent.vibrant};
    content: '';
  }
`;

const CellSurface = styled('div')<{
  $isDragging: boolean;
  $kind: InvestigationCellKind;
}>`
  position: relative;
  overflow: ${p => (p.$kind === 'query' ? 'hidden' : 'visible')};
  border: ${p => {
    if (p.$kind === 'query') {
      return `1px solid ${p.theme.tokens.border.primary}`;
    }
    return p.$isDragging
      ? `1px solid ${p.theme.tokens.border.secondary}`
      : '1px solid transparent';
  }};
  border-radius: ${p => (p.$kind === 'query' ? p.theme.radius.md : '0')};
  background: ${p => p.theme.tokens.background.primary};
`;

const CellDragHandle = styled('div')<{
  $isDragActive: boolean;
  $isDragging: boolean;
}>`
  position: absolute;
  z-index: 2;
  top: 4px;
  left: -36px;
  opacity: ${p => (p.$isDragging ? 1 : 0)};
  pointer-events: ${p => (p.$isDragActive && !p.$isDragging ? 'none' : 'auto')};
  transition: opacity 120ms ease;

  ${CellCard}:hover & {
    opacity: ${p => (p.$isDragActive && !p.$isDragging ? 0 : 1)};
  }
`;

const CellActionsRail = styled(Stack)<{$hidden: boolean}>`
  position: absolute;
  z-index: 2;
  top: ${p => p.theme.space.md};
  right: -40px;
  align-items: center;
  gap: 1px;
  opacity: ${p => (p.$hidden ? 0 : 0)};
  pointer-events: ${p => (p.$hidden ? 'none' : 'auto')};
  transition: opacity 120ms ease;

  ${CellCard}:hover & {
    ${p => (p.$hidden ? '' : 'opacity: 1;')}
  }

  > button,
  > span > button {
    width: 26px;
    min-width: 26px;
    height: 26px;
    min-height: 26px;
    padding: 4px;

    svg {
      width: 15px;
      height: 15px;
    }
  }
`;

const InlineReactionPicker = styled(Flex)`
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 999px;
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.medium};
  white-space: nowrap;
`;

const EmojiReactionButton = styled('button')`
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 16px;

  &:hover,
  &:focus-visible {
    background: ${p => p.theme.tokens.background.secondary};
    outline: none;
  }
`;

const CellReactionSummary = styled(Flex)<{$hidden: boolean}>`
  position: absolute;
  z-index: 2;
  top: -6px;
  right: ${p => p.theme.space.sm};
  align-items: center;
  gap: 3px;
  opacity: ${p => (p.$hidden ? 0 : 0.58)};
  pointer-events: ${p => (p.$hidden ? 'none' : 'auto')};
  transition: opacity 120ms ease;

  &:hover,
  &:focus-within {
    opacity: ${p => (p.$hidden ? 0 : 1)};
  }
`;

const ReactionPill = styled('button')<{$reacted: boolean}>`
  padding: 1px 6px;
  border: 1px solid
    ${p =>
      p.$reacted
        ? p.theme.tokens.border.accent.vibrant
        : p.theme.tokens.border.secondary};
  border-radius: 999px;
  background: ${p =>
    p.$reacted ? p.theme.tokens.background.secondary : p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  cursor: pointer;
  font-size: ${p => p.theme.font.size.xs};

  &:disabled {
    cursor: default;
  }
`;

const QueryRunButton = styled(Button)<{$hidden: boolean}>`
  opacity: ${p => (p.$hidden ? 0 : 1)};
`;

const QueryPromptDisclosure = styled(Disclosure)`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
`;

const QueryPromptContent = styled(Disclosure.Content)`
  padding: 0;
`;

const QuerySummary = styled(Text)`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const QueryEditorWrap = styled('div')`
  position: relative;
`;

const ContextHint = styled(Text)`
  display: block;
  padding: 0 ${p => p.theme.space.lg} ${p => p.theme.space.md};
`;

const CellInput = styled(TextArea)<{$kind: InvestigationCellKind}>`
  width: 100%;
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.55;
  resize: none !important;

  &:focus,
  &:focus-visible {
    border: 0;
    outline: none;
    box-shadow: none;
  }

  ${p =>
    p.$kind === 'query'
      ? css`
          min-height: 68px;
          padding-top: ${p.theme.space.md};
          padding-left: ${p.theme.space.lg};
          padding-right: ${p.theme.space.lg};
          padding-bottom: ${p.theme.space.md};
        `
      : ''}
`;

const QueryPlaceholder = styled('div')`
  position: absolute;
  top: ${p => p.theme.space.md};
  left: ${p => p.theme.space.lg};
  pointer-events: none;
`;

const QueryExampleButton = styled('button')`
  padding: 0;
  border: 0;
  background: transparent;
  color: ${p => p.theme.tokens.content.accent};
  cursor: pointer;
  font: inherit;
  pointer-events: auto;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }
`;

const TextCellBody = styled('div')`
  position: relative;
  min-height: 44px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const TextEditorWrap = styled('div')`
  position: relative;
`;

const RenderedMarkdown = styled('div')`
  min-height: 32px;
  cursor: text;

  &:focus-visible {
    outline: none;
  }
`;

const SlashCommandMenu = styled('div')`
  position: absolute;
  z-index: ${p => p.theme.zIndex.dropdown};
  top: calc(100% + ${p => p.theme.space.xs});
  left: 0;
  width: min(320px, 100%);
  max-height: 360px;
  overflow-y: auto;
  padding: ${p => p.theme.space.xs};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.medium};
`;

const SlashCommandButton = styled('button')<{$selected: boolean}>`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 0;
  border-radius: ${p => p.theme.radius.sm};
  background: ${p => (p.$selected ? p.theme.tokens.background.secondary : 'transparent')};
  cursor: pointer;
  text-align: left;

  &:hover,
  &:focus-visible {
    background: ${p => p.theme.tokens.background.secondary};
    outline: none;
  }
`;

const SlashCommandEmpty = styled('div')`
  padding: ${p => p.theme.space.md};
  text-align: center;
`;

const InsertDivider = styled('div')`
  position: relative;
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: center;

  &::before {
    position: absolute;
    right: 0;
    left: 0;
    height: 0;
    border-top: 2px solid ${p => p.theme.tokens.border.accent.vibrant};
    content: '';
    opacity: 0;
    transition: opacity 120ms ease;
  }

  &:hover::before,
  &:focus-within::before {
    opacity: 1;
  }
`;

const InsertButton = styled(Button)`
  z-index: 1;
  border-radius: 999px;
  opacity: 0;
  transition: opacity 120ms ease;
  color: ${p => p.theme.tokens.content.accent};

  ${InsertDivider}:hover &,
  ${InsertDivider}:focus-within & {
    opacity: 1;
  }
`;

const InsertPlaceholderButton = styled('button')`
  z-index: 1;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 999px;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.accent};
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 120ms ease,
    background 120ms ease;

  &:hover,
  &:focus-visible {
    background: ${p => p.theme.tokens.background.secondary};
    outline: none;
  }

  ${InsertDivider}:hover &,
  ${InsertDivider}:focus-within & {
    opacity: 1;
  }
`;
