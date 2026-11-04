import {Fragment} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconStack} from '@sentry/icons/stack';
import {useQueryClient} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  getInvestigationDetailQueryOptions,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
} from 'sentry/views/investigations/api';
import {InvestigationAccess} from 'sentry/views/investigations/detail/investigationAccess';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/investigationPageContent';
import {useInvestigationDetail} from 'sentry/views/investigations/detail/useInvestigationDetail';
import {useInvestigationTitle} from 'sentry/views/investigations/detail/useInvestigationTitle';
import {useInvestigationAskSeer} from 'sentry/views/investigations/investigationLLMContext';
import type {InvestigationDetail} from 'sentry/views/investigations/types';
import {
  getInvestigationPath,
  getInvestigationsPath,
} from 'sentry/views/investigations/utils';
import {TopBar} from 'sentry/views/navigation/topBar';
import {RouteError} from 'sentry/views/routeError';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function InvestigationDetailPageInner({
  investigation,
}: {
  investigation: InvestigationDetail;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const title = useInvestigationTitle(investigation);
  const {getLLMContext} = useLLMContext();
  const askSeer = useInvestigationAskSeer();
  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: duplicate => {
      addSuccessMessage(t('Investigation duplicated.'));
      navigate(getInvestigationPath(organization.slug, duplicate.id));
    },
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });
  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onMutate: () => title.cancelPendingRename(),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: getInvestigationDetailQueryOptions(organization.slug, investigation.id)
          .queryKey,
        exact: true,
      });
      addSuccessMessage(t('Investigation deleted.'));
      navigate(getInvestigationsPath(organization.slug));
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={title.displayedTitle} orgSlug={organization.slug} />
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: title.displayedTitle,
          trailingActions: {
            type: 'menu',
            items: [
              ...(askSeer
                ? [
                    {
                      key: 'ask-seer',
                      label: t('Ask Seer'),
                      onAction: () =>
                        askSeer({
                          prompt: t(
                            'What would you like to know about this investigation?'
                          ),
                          // This node with everything beneath it, so the
                          // hypotheses and blocks on screen come along.
                          context: getLLMContext(true).nodes[0],
                        }),
                    },
                  ]
                : []),
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
            ],
            triggerLabel: t('Investigation actions'),
            triggerIcon: <IconEllipsis />,
          },
        }}
        items={[
          {
            type: 'link',
            label: t('Investigations'),
            to: getInvestigationsPath(organization.slug),
            leadingGraphic: <IconStack size="md" />,
          },
        ]}
      />
      <InvestigationPageContent investigation={investigation} title={title} />
    </Fragment>
  );
}

const InvestigationDetailPage = registerLLMContext(
  'investigation',
  InvestigationDetailPageInner
);

export function InvestigationBootstrapPage({investigationId}: {investigationId: string}) {
  const {
    data: investigation,
    error,
    isError,
    isPending,
  } = useInvestigationDetail(investigationId);

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

  return <InvestigationDetailPage investigation={investigation} />;
}

export default function InvestigationDetailView() {
  const {investigationId} = useParams<{investigationId: string}>();

  return (
    <AnalyticsArea name="investigations.details" overrideParent>
      <InvestigationAccess>
        <InvestigationBootstrapPage investigationId={investigationId} />
      </InvestigationAccess>
    </AnalyticsArea>
  );
}
