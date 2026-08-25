import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncer} from '@tanstack/react-pacer';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconSeer, IconStack} from 'sentry/icons';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  getInvestigationDetailQueryOptions,
  useAddInvestigationBlockMutation,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useRenameInvestigationMutation,
} from 'sentry/views/investigations/api';
import {
  InvestigationCell,
  shouldPollInvestigationBlocks,
} from 'sentry/views/investigations/detail/cell';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import type {
  InvestigationBlockKind,
  InvestigationDetail,
} from 'sentry/views/investigations/types';
import {RouteError} from 'sentry/views/routeError';

function FeatureDisabledPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    </Stack>
  );
}

function ClosedMembershipPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning">
          {t('Investigations are only available to organizations with open membership.')}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

function InvestigationBootstrapPage({investigationId}: {investigationId: string}) {
  const organization = useOrganization();
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigationId
  );
  const {
    data: investigation,
    error,
    isError,
    isPending,
  } = useQuery({
    ...detailOptions,
    refetchInterval: query => {
      const data = query.state.data?.json;
      return shouldPollInvestigationBlocks(data?.blocks ?? []) ||
        isTitleGenerationActive(data?.titleGeneration?.status)
        ? 2000
        : false;
    },
  });

  if (isPending && !investigation) {
    return <LoadingIndicator />;
  }
  if (isError && !investigation) {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <RouteError error={error} />
      </Stack>
    );
  }
  if (!investigation) {
    return null;
  }

  return <InvestigationPageContent investigation={investigation} />;
}

function InvestigationPageContent({investigation}: {investigation: InvestigationDetail}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const [draftTitle, setDraftTitle] = useState(investigation.title);
  const persistedTitle = useRef(investigation.title);
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigation.id
  );

  const renameMutation = useRenameInvestigationMutation(
    organization.slug,
    investigation.id,
    {
      onSuccess: updated => {
        persistedTitle.current = updated.title;
      },
      onError: () => addErrorMessage(t('Unable to rename investigation.')),
    }
  );
  const renameDebouncer = useDebouncer(
    (nextTitle: string) => {
      const title = nextTitle.trim();
      if (title && title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
    },
    {wait: 500, onUnmount: debouncer => debouncer.flush()}
  );

  useEffect(() => {
    if (
      draftTitle === persistedTitle.current &&
      investigation.title !== persistedTitle.current
    ) {
      persistedTitle.current = investigation.title;
      // Keep an in-progress user edit, but adopt a generated title while the draft is clean.
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setDraftTitle(investigation.title);
    }
  }, [draftTitle, investigation.title]);
  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: duplicate => {
      addSuccessMessage(t('Investigation duplicated.'));
      navigate(getInvestigationPath(organization.slug, duplicate.id));
    },
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });
  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onMutate: () => renameDebouncer.cancel(),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: detailOptions.queryKey,
        exact: true,
      });
      addSuccessMessage(t('Investigation deleted.'));
      navigate(`/organizations/${organization.slug}/explore/investigations/`);
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });
  const addBlockMutation = useAddInvestigationBlockMutation(
    organization.slug,
    investigation.id,
    {onError: () => addErrorMessage(t('Unable to add cell.'))}
  );

  function handleTitleChange(nextTitle: string) {
    setDraftTitle(nextTitle);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: nextTitle})
    );
    renameDebouncer.maybeExecute(nextTitle);
  }

  function handleTitleBlur() {
    renameDebouncer.cancel();
    const title = draftTitle.trim();
    if (title) {
      if (title !== draftTitle) {
        setDraftTitle(title);
        updateInvestigationCache(
          queryClient,
          organization.slug,
          investigation.id,
          current => ({...current, title})
        );
      }
      if (title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
      return;
    }
    handleTitleChange(persistedTitle.current);
  }

  const blocks = investigation.blocks ?? [];
  const summaryBlock = investigation.template ? blocks[0] : undefined;
  const notebookCells = summaryBlock ? blocks.slice(1) : blocks;

  async function handleAddBlock({
    kind,
    prompt,
    title,
  }: {
    kind: InvestigationBlockKind;
    prompt: string;
    title: string;
  }) {
    await addBlockMutation.mutateAsync({investigation, kind, prompt, title});
  }

  return (
    <SentryDocumentTitle title={draftTitle} orgSlug={organization.slug}>
      <Stack flex={1}>
        <Layout.Title>
          <HeaderBreadcrumbs
            align="center"
            gap="sm"
            minWidth={0}
            data-test-id="investigation-breadcrumbs"
            data-text-size="md"
          >
            <IconStack size="md" />
            <HeaderBreadcrumbLink
              to={`/organizations/${organization.slug}/explore/investigations/`}
            >
              {t('Investigations')}
            </HeaderBreadcrumbLink>
            <HeaderDivider>/</HeaderDivider>
            <HeaderInvestigationTitle>{draftTitle}</HeaderInvestigationTitle>
            <DropdownMenu
              items={[
                {
                  key: 'copy-link',
                  label: t('Copy link'),
                  onAction: () =>
                    copy(
                      `${window.location.origin}${getInvestigationPath(
                        organization.slug,
                        investigation.id
                      )}`,
                      {successMessage: t('Investigation link copied.')}
                    ),
                },
                {
                  key: 'duplicate',
                  label: t('Duplicate'),
                  onAction: () => duplicateMutation.mutate(investigation),
                },
                {
                  key: 'delete',
                  label: t('Delete'),
                  priority: 'danger',
                  onAction: () =>
                    openConfirmModal({
                      message: t('Are you sure you want to delete this investigation?'),
                      priority: 'danger',
                      confirmText: t('Delete'),
                      onConfirm: () => deleteMutation.mutate(investigation),
                    }),
                },
              ]}
              triggerProps={{
                size: 'sm',
                showChevron: false,
                variant: 'transparent',
                icon: <IconEllipsis />,
                'aria-label': t('Investigation actions'),
              }}
              position="bottom-end"
              usePortal
            />
          </HeaderBreadcrumbs>
        </Layout.Title>
        <Container as="header" width="100%" padding="xl" borderBottom="primary">
          <Grid
            columns="minmax(0, 1fr) auto"
            align="start"
            gap="lg"
            width="100%"
            maxWidth="885px"
            margin="0 auto"
          >
            <Stack gap="xs" minWidth={0}>
              <NotebookTitleInput
                aria-label={t('Investigation title')}
                value={draftTitle}
                onChange={event => handleTitleChange(event.target.value)}
                onBlur={handleTitleBlur}
                maxLength={200}
                aria-busy={renameMutation.isPending}
              />
              <Flex align="center" gap="sm" wrap="wrap">
                <Text variant="muted">{formatSourceType(investigation.sourceType)}</Text>
                <MetaDivider />
                <Text variant="muted">{t('%s blocks', investigation.blockCount)}</Text>
                <MetaDivider />
                <Text variant="muted">
                  {t('Last update: %s', formatNotebookDate(investigation.dateUpdated))}
                </Text>
              </Flex>
            </Stack>
            <Flex align="center" gap="sm">
              <Badge variant={getStatusVariant(investigation.status)}>
                {formatStatus(investigation.status)}
              </Badge>
              <IconSeer size="sm" />
            </Flex>
          </Grid>
        </Container>
        <Layout.Body>
          <Layout.Main width="full">
            <InvestigationCanvas>
              {summaryBlock ? (
                <InvestigationCell
                  block={summaryBlock}
                  canRun={investigation.status === 'active'}
                  investigation={investigation}
                />
              ) : null}

              <Stack gap="xl">
                {notebookCells.map(block => (
                  <InvestigationCell
                    key={block.id}
                    block={block}
                    canRun={investigation.status === 'active'}
                    investigation={investigation}
                  />
                ))}
              </Stack>
              {investigation.status === 'active' ? (
                <AddCellComposer
                  isAdding={addBlockMutation.isPending}
                  onAdd={handleAddBlock}
                />
              ) : null}
            </InvestigationCanvas>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}

function AddCellComposer({
  isAdding,
  onAdd,
}: {
  isAdding: boolean;
  onAdd: (cell: {
    kind: InvestigationBlockKind;
    prompt: string;
    title: string;
  }) => Promise<void>;
}) {
  const [kind, setKind] = useState<InvestigationBlockKind | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');

  function reset() {
    setKind(null);
    setTitle('');
    setPrompt('');
  }

  async function handleAdd() {
    if (!kind || !prompt.trim()) {
      return;
    }
    try {
      await onAdd({kind, title: title.trim(), prompt: prompt.trim()});
      reset();
    } catch {
      // The mutation owns user-facing error handling and leaves the draft intact.
    }
  }

  if (!kind) {
    return (
      <AddCellActions align="center" justify="center" gap="sm">
        <Button size="sm" icon={<IconAdd />} onClick={() => setKind('text')}>
          {t('Text cell')}
        </Button>
        <Button size="sm" icon={<IconAdd />} onClick={() => setKind('query')}>
          {t('Query cell')}
        </Button>
      </AddCellActions>
    );
  }

  return (
    <CellComposer>
      <Stack gap="md">
        <Heading as="h2" size="md">
          {kind === 'text' ? t('Add text cell') : t('Add query cell')}
        </Heading>
        <Input
          aria-label={t('Cell title')}
          placeholder={t('Title (optional)')}
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <TextArea
          aria-label={t('Cell instructions')}
          autosize
          autoFocus
          rows={3}
          placeholder={
            kind === 'text'
              ? t('Describe the text to generate')
              : t('Describe the query to run')
          }
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
        />
        <Flex align="center" justify="end" gap="sm">
          <Button size="sm" onClick={reset} disabled={isAdding}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            busy={isAdding}
            disabled={!prompt.trim()}
            onClick={() => void handleAdd()}
          >
            {t('Add cell')}
          </Button>
        </Flex>
      </Stack>
    </CellComposer>
  );
}

function isTitleGenerationActive(status: string | null | undefined) {
  return status === 'pending' || status === 'running';
}

function getInvestigationPath(organizationSlug: string, investigationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/investigation/${investigationId}/`
  );
}

function formatSourceType(sourceType: string) {
  if (sourceType === 'metric_open_period') {
    return t('Breached metric');
  }
  if (sourceType === 'manual') {
    return t('Manual investigation');
  }
  return sourceType.replaceAll('_', ' ');
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}

function formatNotebookDate(date: string) {
  return new Date(date).toISOString().slice(0, 10).replaceAll('-', '.');
}

function getStatusVariant(status: string): 'success' | 'warning' | 'muted' {
  if (status === 'completed' || status === 'active') {
    return 'success';
  }
  if (status === 'pending') {
    return 'warning';
  }
  return 'muted';
}

const InvestigationCanvas = styled(Stack)`
  width: min(100%, 884px);
  margin: 0 auto;
`;

const HeaderBreadcrumbs = styled(Flex)`
  height: 32px;
  overflow: hidden;
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 32px;
  white-space: nowrap;
`;

const HeaderBreadcrumbLink = styled(Link)`
  overflow: hidden;
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.border.primary};
  text-underline-offset: 5px;
  text-overflow: ellipsis;
`;

const HeaderDivider = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const HeaderInvestigationTitle = styled('span')`
  overflow: hidden;
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.border.primary};
  text-underline-offset: 5px;
  text-overflow: ellipsis;
`;

const NotebookTitleInput = styled(Input)`
  width: 100%;
  height: auto;
  margin: 0;
  padding: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: transparent;
  border-color: transparent;
  border-radius: ${p => p.theme.radius.sm};
  box-shadow: none;
  font-size: ${p => p.theme.font.size['2xl']};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.25;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;

const MetaDivider = styled('span')`
  height: 16px;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const AddCellActions = styled(Flex)`
  padding: ${p => p.theme.space.xl} 0;
`;

const CellComposer = styled('section')`
  width: min(100%, 862px);
  margin: ${p => p.theme.space.lg} auto 0;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

export default function InvestigationDetailView() {
  const organization = useOrganization();
  const {investigationId} = useParams<{investigationId: string}>();

  return (
    <AnalyticsArea name="investigations.details" overrideParent>
      <Feature
        organization={organization}
        features="organizations:investigations"
        renderDisabled={() => <FeatureDisabledPage />}
      >
        {organization.openMembership ? (
          <InvestigationBootstrapPage investigationId={investigationId} />
        ) : (
          <ClosedMembershipPage />
        )}
      </Feature>
    </AnalyticsArea>
  );
}
