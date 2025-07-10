import {css} from '@emotion/react';
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
import {withChonk} from 'sentry/utils/theme/withChonk';
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
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

type IssueViewSaveButtonProps = {
  query: string;
  sort: IssueSortOptions;
};

function SegmentedIssueViewSaveButton({
  openCreateIssueViewModal,
}: {
  openCreateIssueViewModal: () => void;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {hasUnsavedChanges} = useIssueViewUnsavedChanges();
  const buttonPriority = hasUnsavedChanges ? 'primary' : 'default';
  const {data: view} = useSelectedGroupSearchView();
  const {mutate: updateGroupSearchView, isPending: isSaving} = useUpdateGroupSearchView();
  const user = useUser();
  const canEdit = view
    ? canEditIssueView({user, groupSearchView: view, organization})
    : false;
  const discardUnsavedChanges = () => {
    if (view) {
      trackAnalytics('issue_views.reset.clicked', {organization});
      navigate({
        pathname: location.pathname,
        query: getIssueViewQueryParams({view}),
      });
    }
  };

  const saveView = () => {
    if (view) {
      trackAnalytics('issue_views.save.clicked', {organization});
      updateGroupSearchView(
        {
          id: view.id,
          name: view.name,
          ...createIssueViewFromUrl({query: location.query}),
        },
        {
          onSuccess: () => {
            addSuccessMessage(t('Saved changes'));
          },
        }
      );
    }
  };

  return (
    <Feature
      features={'organizations:issue-views'}
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
        <ButtonBar merged>
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
                    color={buttonPriority === 'primary' ? undefined : 'subText'}
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
        features={'organizations:issue-views'}
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
    <SegmentedIssueViewSaveButton openCreateIssueViewModal={openCreateIssueViewModal} />
  );
}

const PrimarySaveButton = withChonk(
  styled(Button)`
    box-shadow: none;

    ${p =>
      p.priority === 'primary' &&
      css`
        &::after {
          content: '';
          position: absolute;
          top: -1px;
          bottom: -1px;
          right: -1px;
          border-right: solid 1px currentColor;
          opacity: 0.25;
        }
      `}
  `,
  Button
);

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  border-left: none;
`;
