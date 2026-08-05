import {
  Fragment,
  memo,
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
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
import {css, keyframes} from '@emotion/react';
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
  IconPause,
  IconPlay,
  IconSettings,
  IconStar,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SortableReleasesSelect} from 'sentry/views/dashboards/sortableReleasesSelect';
import {DashboardFilterKeys} from 'sentry/views/dashboards/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {CellStore} from 'sentry/views/seerNotebook/stores/cellStore';
import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import {
  NotebookStoreProvider,
  useNotebookStore,
} from 'sentry/views/seerNotebook/stores/storeContext';
import {QueryClientInvestigationTransport} from 'sentry/views/seerNotebook/stores/transport';

import {CellComments} from './comments';
import {
  ChartSettingsControl,
  PersistedCellOutput,
  TextCellExecutionOutput,
} from './output';
import {InvestigationParameters} from './parameters';
import {InvestigationSettings} from './settings';
import type {
  InvestigationCellKind,
  InvestigationDetail,
  InvestigationFilters,
  InvestigationReactionName,
} from './types';
import {INVESTIGATION_REACTIONS} from './types';

const QUERY_EXAMPLE_STREAM_FRAMES = 24;
const QUERY_EXAMPLE_STREAM_INTERVAL_MS = 16;

type SeerInvestigationProps = {
  onCellListRender?: ProfilerOnRenderCallback;
  onCellRender?: (clientKey: string) => void;
};

export default function SeerInvestigation() {
  return <SeerInvestigationView />;
}

export function SeerInvestigationPerformanceHarness(props: SeerInvestigationProps) {
  return <SeerInvestigationView {...props} />;
}

function SeerInvestigationView({onCellListRender, onCellRender}: SeerInvestigationProps) {
  const organization = useOrganization();
  const {investigationId} = useParams<{investigationId: string}>();
  if (!organization.features.includes('investigations')) {
    return (
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    );
  }
  return (
    <SeerInvestigationContent
      key={investigationId ?? 'missing'}
      onCellListRender={onCellListRender}
      onCellRender={onCellRender}
    />
  );
}

function SeerInvestigationContent({
  onCellListRender,
  onCellRender,
}: SeerInvestigationProps) {
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
      <InvestigationEditor
        onCellListRender={onCellListRender}
        onCellRender={onCellRender}
      />
    </NotebookStoreProvider>
  );
}

const InvestigationEditor = observer(function InvestigationEditor({
  onCellListRender,
  onCellRender,
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
          store={store}
          onArchive={() => {
            openConfirmModal({
              message: t('Archive this investigation? It will become read-only.'),
              confirmText: t('Archive'),
              priority: 'danger',
              onConfirm: () => store.archive(),
            });
          }}
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
          <InvestigationParameters store={store} />
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
              disabled={readOnly || store.isTitleGenerating}
              aria-label={t('Edit investigation name')}
              onClick={() => {
                store.editTitle(detail.title);
                setIsEditingTitle(true);
              }}
            >
              {store.isTitleGenerating
                ? store.titleGenerationPreview || t('Writing title…')
                : detail.title}
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
                      cell={cellStore}
                      index={index}
                      disabled={readOnly}
                      collaborationDisabled={detail.status === 'archived'}
                      onInsertAfter={kind => store.insertCell(kind, index + 1)}
                      onRender={onCellRender}
                      onDelete={() =>
                        openConfirmModal({
                          message: t('Delete this cell?'),
                          confirmText: t('Delete'),
                          priority: 'danger',
                          onConfirm: () => store.deleteCell(cellStore.clientKey),
                        })
                      }
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
  store,
  onArchive,
}: ModalRenderProps & {
  onArchive: () => void;
  store: NotebookStore;
}) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Investigation settings')}</Heading>
      </Header>
      <Body>
        <InvestigationSettings store={store} onArchive={onArchive} />
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
  cell: CellStore;
  collaborationDisabled: boolean;
  disabled: boolean;
  index: number;
  onDelete: () => void;
  onInsertAfter: (kind: InvestigationCellKind) => Promise<void>;
  onRender?: (clientKey: string) => void;
};

type SortableCellState = ReturnType<typeof useSortable>;
type SortableCellPresentation = {
  dropIndicator: 'after' | 'before' | null;
  isDragActive: boolean;
};

const CellExecutionControl = observer(function CellExecutionControl({
  cell,
  hidden,
  disabled,
}: {
  cell: CellStore;
  disabled: boolean;
  hidden: boolean;
}) {
  const mode = cell.executionControlMode;
  const isWorking = mode === 'stop';
  const isStopping = cell.outputStatus === 'stopping';
  const isTextCell = cell.kind === 'text';

  const activate = async () => {
    try {
      await cell.activateExecutionControl();
    } catch {
      addErrorMessage(
        mode === 'stop'
          ? isTextCell
            ? t('The generation could not be stopped.')
            : t('The query could not be stopped.')
          : isTextCell
            ? t('The generation could not be started.')
            : t('The query could not be started.')
      );
    }
  };

  return (
    <QueryRunButton
      $hidden={hidden}
      $stoppable={isWorking && !isStopping && !cell.isRunRequested}
      size="xs"
      variant={mode === 'retry' ? 'primary' : cell.runButtonVariant}
      icon={isWorking || mode === 'retry' ? undefined : <IconPlay size="xs" />}
      aria-label={
        isWorking ? (isTextCell ? t('Stop generation') : t('Stop query')) : undefined
      }
      disabled={
        disabled || cell.isRunRequested || isStopping || (mode !== 'stop' && !cell.canRun)
      }
      onClick={() => void activate()}
    >
      {isWorking ? (
        <ExecutionButtonLabels>
          <WorkingButtonLabel>
            <LoadingDot aria-hidden="true" data-test-id="cell-run-spinner" />
          </WorkingButtonLabel>
          <StopButtonLabel>
            <IconPause size="xs" />
            {t('Stop')}
          </StopButtonLabel>
        </ExecutionButtonLabels>
      ) : mode === 'retry' ? (
        t('Retry')
      ) : (
        t('Run')
      )}
    </QueryRunButton>
  );
});

function SortableCell(props: SortableCellProps) {
  const sortable = useSortable({
    id: props.cell.clientKey,
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
  onInsertAfter,
  onDelete,
  onRender,
  sortable,
}: SortableCellProps & SortableCellPresentation & {sortable: SortableCellState}) {
  onRender?.(cell.clientKey);
  const draft = {
    title: cell.title,
    content: cell.content,
    generationPrompt: cell.generationPrompt,
    display: cell.display,
  };
  const {notebook} = cell;
  const queryExecutionEnabled = notebook.queryExecutionEnabled;
  const [isEditingText, setIsEditingText] = useState(!cell.content && !disabled);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommandIndex, setSlashCommandIndex] = useState(0);
  const cellReactions = cell.reactions;
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousOutputStatusRef = useRef(cell.outputStatus);
  const queryIntent = cell.queryIntent;
  const promptCollapsed = draft.display.promptCollapsed !== false;
  const queryCollapsed = draft.display.queryCollapsed !== false;

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
    void cell
      .flush()
      .catch(() => addErrorMessage(t('The cell change could not be saved.')));
  };

  const applySlashCommand = (prefix: string) => {
    cell.applySlashCommand(prefix);
    setShowSlashMenu(false);
    requestAnimationFrame(() => {
      textInputRef.current?.focus();
      const position = cell.content.length;
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
      cell.editContent(nextDraft.content);
      void cell.flush();
      setShowSlashMenu(false);
      void onInsertAfter('query');
      return;
    }
    applySlashCommand(command.prefix);
  };

  const queryExample = t(
    'Compare error volume over time across the selected projects. Show daily error counts for the last 30 days, grouped by project.'
  );

  const streamQuerySuggestion = (suggestion: string) => {
    if (suggestionTimerRef.current) {
      clearInterval(suggestionTimerRef.current);
    }
    let characterIndex = 0;
    const charactersPerFrame = Math.max(
      1,
      Math.ceil(suggestion.length / QUERY_EXAMPLE_STREAM_FRAMES)
    );
    cell.clearQueryIntent();
    textInputRef.current?.focus();
    suggestionTimerRef.current = setInterval(() => {
      characterIndex = Math.min(suggestion.length, characterIndex + charactersPerFrame);
      cell.editQueryIntent(suggestion.slice(0, characterIndex));
      if (characterIndex >= suggestion.length) {
        if (suggestionTimerRef.current) {
          clearInterval(suggestionTimerRef.current);
          suggestionTimerRef.current = null;
        }
      }
    }, QUERY_EXAMPLE_STREAM_INTERVAL_MS);
  };

  const toggleCellReaction = async (
    reaction: InvestigationReactionName,
    enabled: boolean
  ) => {
    try {
      await cell.toggleReaction(reaction, enabled);
    } catch {
      addErrorMessage(t('Unable to update the reaction.'));
    }
  };

  const comments = <CellComments cell={cell} disabled={collaborationDisabled} />;

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
      <CellActionsRail $hidden={isDragActive} $pinned={isReactionPickerOpen}>
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
      <CellSurface $isDragging={sortable.isDragging}>
        {cell.kind === 'text' ? (
          <Fragment>
            <QueryPromptDisclosure
              $expanded={!promptCollapsed}
              size="sm"
              expanded={!promptCollapsed}
              onExpandedChange={expanded =>
                cell.setPromptSectionCollapsed('prompt', !expanded)
              }
            >
              <Disclosure.Title
                trailingItems={
                  <HeaderActions>
                    <CellExecutionControl
                      cell={cell}
                      hidden={isDragActive}
                      disabled={
                        disabled ||
                        !draft.generationPrompt.trim() ||
                        !queryExecutionEnabled
                      }
                    />
                  </HeaderActions>
                }
              >
                <QuerySummary size="sm">
                  {promptCollapsed
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
                    onChange={event => cell.editGenerationPrompt(event.target.value)}
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
                      cell.editContent(content);
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
            <TextCellExecutionOutput cell={cell} />
          </Fragment>
        ) : (
          <Fragment>
            <QueryPromptDisclosure
              $expanded={!queryCollapsed}
              size="sm"
              expanded={!queryCollapsed}
              onExpandedChange={expanded =>
                cell.setPromptSectionCollapsed('query', !expanded)
              }
            >
              <Disclosure.Title
                trailingItems={
                  <HeaderActions>
                    <ChartSettingsControl cell={cell} disabled={disabled} />
                    <CellExecutionControl
                      cell={cell}
                      hidden={isDragActive}
                      disabled={disabled || !queryIntent.trim() || !queryExecutionEnabled}
                    />
                  </HeaderActions>
                }
              >
                <QuerySummary size="sm">
                  {queryCollapsed
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
                      }
                      cell.editQueryIntent(event.target.value);
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
            <PersistedCellOutput cell={cell} disabled={disabled} />
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
    previous.onRender === next.onRender
  );
}

const MemoizedSortableCellContent = memo(
  observer(SortableCellContent),
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
  width: calc(100% + ${p => p.theme.space.lg} + ${p => p.theme.space.lg});
  margin-left: -${p => p.theme.space.lg};
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

  &:has([aria-label='Cell comments']) {
    z-index: 4;
  }

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

const CellSurface = styled('div')<{$isDragging: boolean}>`
  position: relative;
  overflow: hidden;
  border: 1px solid
    ${p =>
      p.$isDragging ? p.theme.tokens.border.secondary : p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p =>
    p.theme.type === 'dark'
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.primary};
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

const CellActionsRail = styled(Stack)<{$hidden: boolean; $pinned: boolean}>`
  position: absolute;
  z-index: 2;
  top: ${p => p.theme.space.md};
  right: -40px;
  align-items: center;
  gap: 1px;
  opacity: ${p => (p.$hidden ? 0 : p.$pinned ? 1 : 0)};
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
  opacity: ${p => (p.$hidden ? 0 : 1)};
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

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const ExecutionButtonLabels = styled('span')`
  display: inline-flex;
  align-items: center;
`;

const WorkingButtonLabel = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const StopButtonLabel = styled('span')`
  display: none;
  align-items: center;
  gap: ${p => p.theme.space.xs};
`;

const LoadingDot = styled('span')`
  width: 12px;
  height: 12px;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${spin} 700ms linear infinite;
`;

const QueryRunButton = styled(Button)<{
  $hidden: boolean;
  $stoppable?: boolean;
}>`
  width: 54px;
  min-width: 54px;
  height: 24px;
  min-height: 24px;
  flex-shrink: 0;
  padding: 4px 7px;
  opacity: ${p => (p.$hidden ? 0 : 1)};

  ${p =>
    p.$stoppable &&
    css`
      &:hover ${WorkingButtonLabel}, &:focus-visible ${WorkingButtonLabel} {
        display: none;
      }
      &:hover ${StopButtonLabel}, &:focus-visible ${StopButtonLabel} {
        display: inline-flex;
      }
    `}
`;

const QueryPromptDisclosure = styled(Disclosure)<{$expanded: boolean}>`
  padding: 0;

  > div:first-of-type {
    min-height: 32px;
    padding: 4px;
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    border-radius: 0;
    background: ${p =>
      p.$expanded ? p.theme.tokens.background.secondary : 'transparent'};

    &:hover {
      background: ${p => p.theme.tokens.background.secondary};
    }
  }

  > div:first-of-type > button:first-of-type {
    min-width: 0;
    min-height: 24px;
    height: 24px;
    padding-top: 4px;
    padding-bottom: 4px;
    border-radius: 0;
  }
`;

const QueryPromptContent = styled(Disclosure.Content)`
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
`;

const QuerySummary = styled(Text)`
  display: block;
  width: 100%;
  max-width: 56ch;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HeaderActions = styled(Flex)`
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
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
  height: 22px;
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
  min-width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 999px;
  opacity: 0;
  transition: opacity 120ms ease;
  color: ${p => p.theme.tokens.content.accent};

  svg {
    width: 10px;
    height: 10px;
  }

  ${InsertDivider}:hover &,
  ${InsertDivider}:focus-within & {
    opacity: 1;
  }
`;

const InsertPlaceholderButton = styled('button')`
  z-index: 1;
  display: grid;
  width: 20px;
  height: 20px;
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

  svg {
    width: 10px;
    height: 10px;
  }

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
