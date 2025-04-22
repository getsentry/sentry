import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import {useDeleteGroupSearchView} from 'sentry/views/issueList/mutations/useDeleteGroupSearchView';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {NavIssueView} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';

export interface IssueViewNavEllipsisMenuProps {
  // TODO(msun): Allow deleting last view once horizontal tab views are deleted
  isLastView: boolean;
  setIsEditing: (isEditing: boolean) => void;
  view: NavIssueView;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
}

export function IssueViewNavEllipsisMenu({
  sectionRef,
  setIsEditing,
  view,
  isLastView,
}: IssueViewNavEllipsisMenuProps) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const location = useLocation();
  const {viewId} = useParams<{viewId: string}>();
  const isSelected = viewId === view.id;

  const {mutate: updateIssueView} = useUpdateGroupSearchView({
    onSuccess: () => {
      trackAnalytics('issue_views.saved_changes', {
        leftNav: true,
        organization: organization.slug,
      });
    },
  });

  const {mutate: deleteIssueView} = useDeleteGroupSearchView({
    onSuccess: (_data, variables) => {
      trackAnalytics('issue_views.deleted_view', {
        leftNav: true,
        organization: organization.slug,
      });

      if (variables.id === viewId) {
        navigate(normalizeUrl(`/organizations/${organization.slug}/issues/`));
      }
    },
    onError: () => {
      addErrorMessage(t('Failed to delete view'));
    },
  });

  const {mutate: createIssueView} = useCreateGroupSearchView({
    onSuccess: data => {
      navigate(
        normalizeUrl(`/organizations/${organization.slug}/issues/views/${data.id}/`)
      );
      trackAnalytics('issue_views.duplicated_view', {
        leftNav: true,
        organization,
      });
    },
  });

  const currentViewParams = createIssueViewFromUrl({query: location.query});
  const {hasUnsavedChanges} = useIssueViewUnsavedChanges();

  return (
    <DropdownMenu
      position="bottom-start"
      trigger={props => (
        <TriggerWrapper
          {...props}
          data-ellipsis-menu-trigger
          onPointerDownCapture={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onPointerUpCapture={e => {
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.click();
          }}
          size="zero"
        >
          <IconEllipsis compact color="gray500" />
        </TriggerWrapper>
      )}
      items={[
        {
          key: 'changed',
          children: [
            {
              key: 'save-changes',
              label: t('Save Changes'),
              priority: 'primary',
              onAction: () =>
                updateIssueView({
                  id: view.id,
                  name: view.label,
                  ...currentViewParams,
                }),
            },
            {
              key: 'discard-changes',
              label: t('Discard Changes'),
              onAction: () => {
                navigate(
                  normalizeUrl(
                    `/organizations/${organization.slug}/issues/views/${view.id}/`
                  )
                );
              },
            },
          ],
          hidden: !isSelected || !hasUnsavedChanges,
        },
        {
          key: 'default',
          children: [
            {
              key: 'rename-tab',
              label: t('Rename'),
              onAction: () => setIsEditing(true),
            },
            {
              key: 'duplicate-tab',
              label: t('Duplicate'),
              onAction: () =>
                createIssueView({
                  name: `${view.label} (Copy)`,
                  query: view.query,
                  querySort: view.querySort,
                  projects: view.projects,
                  environments: view.environments,
                  timeFilters: view.timeFilters,
                  starred: true,
                }),
            },
            {
              key: 'delete-tab',
              label: t('Delete'),
              priority: 'danger',
              // TODO(msun): Optimistically render deletion and handle error
              onAction: () => deleteIssueView({id: view.id}),
              disabled: isLastView,
            },
          ],
        },
      ]}
      shouldCloseOnInteractOutside={() => true}
      menuFooter={<FeedbackFooter />}
      usePortal
      portalContainerRef={sectionRef}
    />
  );
}

function FeedbackFooter() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <SectionedOverlayFooter>
      <Button
        size="xs"
        icon={<IconMegaphone />}
        onClick={() =>
          openForm({
            messagePlaceholder: t('How can we make custom views better for you?'),
            tags: {
              ['feedback.source']: 'left_nav_issue_views',
              ['feedback.owner']: 'issues',
            },
          })
        }
      >
        {t('Give Feedback')}
      </Button>
    </SectionedOverlayFooter>
  );
}

const TriggerWrapper = styled(Button)`
  display: flex;
  position: relative;
  width: 24px;
  height: 20px;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  align-items: center;
  justify-content: center;
  padding: 0;
  background-color: inherit;
  opacity: inherit;
`;

const SectionedOverlayFooter = styled('div')`
  grid-area: footer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
