import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {CreateIssueViewModal} from 'sentry/views/issueList/issueViews/createIssueViewModal';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {canEditIssueView} from 'sentry/views/issueList/issueViews/utils';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import {useGenerateIssueViewTitle} from 'sentry/views/issueList/queries/useGenerateIssueViewTitle';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

type IssueViewSaveButtonProps = {
  query: string;
  sort: IssueSortOptions;
};

function SegmentedIssueViewSaveButton({
  openCreateIssueViewModal,
  query,
}: {
  openCreateIssueViewModal: () => void;
  query: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {hasUnsavedChanges} = useIssueViewUnsavedChanges();
  const buttonPriority = hasUnsavedChanges ? 'primary' : 'default';
  const {data: view} = useSelectedGroupSearchView();
  const {mutate: updateGroupSearchView, isPending: isSaving} = useUpdateGroupSearchView();
  const {mutateAsync: generateTitle} = useGenerateIssueViewTitle();
  const user = useUser();
  const canEdit = view
    ? canEditIssueView({user, groupSearchView: view, organization})
    : false;
  const hasAiTitleFeature = organization.features.includes('issue-view-ai-title');
  const isNewView = location.query.new === 'true';
  const hasDefaultName = view?.name === 'New View';

  const discardUnsavedChanges = () => {
    if (view) {
      trackAnalytics('issue_views.reset.clicked', {organization});
      navigate({
        pathname: location.pathname,
        query: getIssueViewQueryParams({view}),
      });
    }
  };

  const saveView = async () => {
    if (view) {
      trackAnalytics('issue_views.save.clicked', {organization});

      let name = view.name;
      if ((isNewView || hasDefaultName) && hasAiTitleFeature && query) {
        try {
          const result = await generateTitle({query});
          name = result.title;
        } catch {
          // Fall back to existing name if generation fails
        }
      }

      updateGroupSearchView(
        {
          id: view.id,
          name,
          ...createIssueViewFromUrl({query: location.query}),
        },
        {
          onSuccess: () => {
            addSuccessMessage(t('Saved changes'));
            if (isNewView) {
              navigate({
                pathname: location.pathname,
                query: {...location.query, new: undefined},
              });
            }
          },
        }
      );
    }
  };

  return (
    <Feature
      features="organizations:issue-views"
      hookName="feature-disabled:issue-views"
      renderDisabled={props => (
        <Hovercard
          body={
            <FeatureDisabled
              features={props.features}
              hideHelpToggle
              featureName={t('Issue Views')}
            />
          }
        >
          {typeof props.children === 'function' ? props.children(props) : props.children}
        </Hovercard>
      )}
    >
      {({hasFeature}) => (
        <ButtonBar merged gap="0">
          <PrimarySaveButton
            priority={buttonPriority}
            data-test-id={hasUnsavedChanges ? 'save-button-unsaved' : 'save-button'}
            onClick={() => {
              if (canEdit) {
                saveView();
              } else {
                openCreateIssueViewModal();
              }
            }}
            disabled={isSaving || !hasFeature}
          >
            {canEdit ? t('Save') : t('Save As')}
          </PrimarySaveButton>
          <DropdownMenu
            items={[
              {
                key: 'reset',
                label: t('Reset'),
                disabled: !hasUnsavedChanges,
                onAction: () => {
                  discardUnsavedChanges();
                },
              },
              {
                key: 'save-as',
                label: t('Save as new view'),
                onAction: () => {
                  openCreateIssueViewModal();
                },
                hidden: !canEdit,
              },
            ]}
            trigger={props => (
              <DropdownTrigger
                {...props}
                disabled={!hasFeature || isSaving}
                icon={
                  <IconChevron
                    direction="down"
                    variant={buttonPriority === 'primary' ? undefined : 'muted'}
                  />
                }
                aria-label={t('More save options')}
                priority={buttonPriority}
              />
            )}
            position="bottom-end"
          />
        </ButtonBar>
      )}
    </Feature>
  );
}

export function IssueViewSaveButton({query, sort}: IssueViewSaveButtonProps) {
  const {viewId} = useParams();
  const {selection} = usePageFilters();
  const {data: view} = useSelectedGroupSearchView();
  const organization = useOrganization();

  const openCreateIssueViewModal = () => {
    trackAnalytics('issue_views.save_as.clicked', {organization});
    openModal(props => (
      <CreateIssueViewModal
        {...props}
        analyticsSurface={viewId ? 'issue-view-details' : 'issues-feed'}
        name={view ? `${view.name} (Copy)` : undefined}
        query={query}
        querySort={sort}
        projects={selection.projects}
        environments={selection.environments}
        timeFilters={selection.datetime}
      />
    ));
  };

  if (!viewId) {
    return (
      <Feature
        features="organizations:issue-views"
        hookName="feature-disabled:issue-views"
        renderDisabled={props => (
          <Hovercard
            body={
              <FeatureDisabled
                features={props.features}
                hideHelpToggle
                featureName={t('Issue Views')}
              />
            }
          >
            {typeof props.children === 'function'
              ? props.children(props)
              : props.children}
          </Hovercard>
        )}
      >
        {({hasFeature}) => (
          <Button
            priority="primary"
            onClick={openCreateIssueViewModal}
            disabled={!hasFeature}
          >
            {t('Save As')}
          </Button>
        )}
      </Feature>
    );
  }

  return (
    <SegmentedIssueViewSaveButton
      openCreateIssueViewModal={openCreateIssueViewModal}
      query={query}
    />
  );
}

const PrimarySaveButton = Button;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  border-left: none;
`;
