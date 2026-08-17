import {useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedCallback} from '@tanstack/react-pacer';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Badge} from '@sentry/scraps/badge';
import {CodeBlock} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconSeer, IconStack} from 'sentry/icons';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  investigationDetailQueryOptions,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useRenameInvestigationMutation,
} from 'sentry/views/investigations/api';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import type {
  InvestigationBlock,
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
  const {
    data: investigation,
    error,
    isError,
    isPending,
  } = useQuery(investigationDetailQueryOptions(organization.slug, investigationId));

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
  const detailOptions = investigationDetailQueryOptions(
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
  const renameInvestigation = renameMutation.mutate;
  const debouncedRename = useDebouncedCallback(
    (nextTitle: string) => {
      const title = nextTitle.trim();
      if (title && title !== persistedTitle.current) {
        renameInvestigation(title);
      }
    },
    {wait: 500}
  );
  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: duplicate => {
      addSuccessMessage(t('Investigation duplicated.'));
      navigate(getInvestigationPath(organization.slug, duplicate.id));
    },
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });
  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onSuccess: () => {
      queryClient.removeQueries({queryKey: detailOptions.queryKey, exact: true});
      addSuccessMessage(t('Investigation deleted.'));
      navigate(`/organizations/${organization.slug}/explore/investigations/`);
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });

  function handleTitleChange(nextTitle: string) {
    setDraftTitle(nextTitle);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: nextTitle})
    );
    debouncedRename(nextTitle);
  }

  function handleTitleBlur() {
    const title = draftTitle.trim();
    if (title) {
      if (title !== draftTitle) {
        handleTitleChange(title);
      }
      return;
    }
    handleTitleChange(persistedTitle.current);
  }

  const blocks = investigation.blocks ?? [];
  const summaryBlock = blocks[0];

  return (
    <SentryDocumentTitle title={draftTitle} orgSlug={organization.slug}>
      <Stack flex={1}>
        <Layout.Title>
          <HeaderBreadcrumbs align="center" gap="sm" minWidth={0}>
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
        <NotebookHeader>
          <NotebookHeaderContent>
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
          </NotebookHeaderContent>
        </NotebookHeader>
        <Layout.Body>
          <Layout.Main width="full">
            <InvestigationCanvas>
              {summaryBlock ? <CurrentUnderstanding block={summaryBlock} /> : null}

              <Stack gap="0">
                {blocks.slice(1).map((block, index) => (
                  <InvestigationCell key={block.id} block={block} index={index} />
                ))}
              </Stack>
            </InvestigationCanvas>
          </Layout.Main>
        </Layout.Body>
        <DebugPanel size="sm" variant="outline">
          <Disclosure.Title>
            <Text size="sm" monospace bold>
              {t('Investigation JSON')}
            </Text>
          </Disclosure.Title>
          <DebugPanelContent>
            <CodeBlock language="json">
              {JSON.stringify(investigation, null, 2)}
            </CodeBlock>
          </DebugPanelContent>
        </DebugPanel>
      </Stack>
    </SentryDocumentTitle>
  );
}

function CurrentUnderstanding({block}: {block: InvestigationBlock}) {
  const output = getBlockOutputMarkdown(block.output);

  return (
    <UnderstandingCard>
      <Stack gap="sm">
        <Text size="sm" variant="muted">
          {t('Current understanding')}
        </Text>
        <Heading as="h2" size="lg">
          {block.title || t('Investigation summary')}
        </Heading>
        {output ? (
          <SeerMarkdown raw={output} />
        ) : (
          <Text variant="muted">{t('This block has no output yet.')}</Text>
        )}
      </Stack>
      <Flex align="center" gap="xs" alignSelf="start">
        <Text bold>{t('View causal chain')}</Text>
      </Flex>
    </UnderstandingCard>
  );
}

function InvestigationCell({block, index}: {block: InvestigationBlock; index: number}) {
  const output = getBlockOutputMarkdown(block.output);

  return (
    <Cell>
      <Stack gap="sm">
        <Heading as="h2" size="lg">
          {block.title || t('Investigation step %s', index + 2)}
        </Heading>
        {output ? (
          <SeerMarkdown raw={output} />
        ) : (
          <Text variant="muted">{t('This block has no output yet.')}</Text>
        )}
      </Stack>
    </Cell>
  );
}

function getBlockOutputMarkdown(output: unknown): string | null {
  if (typeof output === 'string') {
    return output;
  }
  if (!output || typeof output !== 'object') {
    return null;
  }
  if ('markdown' in output && typeof output.markdown === 'string') {
    return output.markdown;
  }
  if ('tableMarkdown' in output && typeof output.tableMarkdown === 'string') {
    return output.tableMarkdown;
  }
  return null;
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
  font-size: ${p => p.theme.font.size.lg};
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

const NotebookHeader = styled('header')`
  width: 100%;
  padding: ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const NotebookHeaderContent = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: ${p => p.theme.space.lg};
  width: min(100%, 885px);
  margin: 0 auto;
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

const UnderstandingCard = styled('section')`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${p => p.theme.space.xl};
  width: 100%;
  margin: 0 0 ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl};
  overflow: hidden;
  border: 1px solid ${p => p.theme.tokens.border.accent.muted};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.low};

  &::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: ${p => p.theme.tokens.background.accent.vibrant};
  }
`;

const Cell = styled('section')`
  width: min(100%, 862px);
  margin: 0 auto;
  padding: ${p => p.theme.space.xl} 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const DebugPanel = styled(Disclosure)`
  position: fixed;
  right: ${p => p.theme.space.xl};
  bottom: ${p => p.theme.space.xl};
  z-index: ${p => p.theme.zIndex.dropdown};
  width: min(560px, calc(100vw - 32px));
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.high};
`;

const DebugPanelContent = styled(Disclosure.Content)`
  max-height: min(60vh, 640px);
  overflow: auto;
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
