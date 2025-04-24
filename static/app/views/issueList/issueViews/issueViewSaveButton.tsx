import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
      navigate({
        pathname: location.pathname,
        query: getIssueViewQueryParams({view}),
      });
    }
  };

  const saveView = () => {
    if (view) {
      updateGroupSearchView({
        id: view.id,
        name: view.name,
        ...createIssueViewFromUrl({query: location.query}),
      });
    }
  };

  return (
    <ButtonBar merged>
      <PrimarySaveButton
        priority={buttonPriority}
        analyticsEventName="issue_views.save.clicked"
        data-test-id={hasUnsavedChanges ? 'save-button-unsaved' : 'save-button'}
        onClick={canEdit ? saveView : openCreateIssueViewModal}
        disabled={isSaving}
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
              trackAnalytics('issue_views.reset.clicked', {organization});
              discardUnsavedChanges();
            },
          },
          {
            key: 'save-as',
            label: t('Save as new view'),
            onAction: () => {
              trackAnalytics('issue_views.save_as.clicked', {organization});
              openCreateIssueViewModal();
            },
            hidden: !canEdit,
          },
        ]}
        trigger={props => (
          <DropdownTrigger
            {...props}
            disabled={isSaving}
            icon={<IconChevron direction="down" />}
            aria-label={t('More save options')}
            priority={buttonPriority}
          />
        )}
        position="bottom-end"
      />
    </ButtonBar>
  );
}

export function IssueViewSaveButton({query, sort}: IssueViewSaveButtonProps) {
  const {viewId} = useParams();
  const {selection} = usePageFilters();
  const {data: view} = useSelectedGroupSearchView();

  const openCreateIssueViewModal = () => {
    openModal(props => (
      <CreateIssueViewModal
        {...props}
        name={view ? `${view.name} (Copy)` : 'New View'}
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
      <Button
        priority="primary"
        onClick={openCreateIssueViewModal}
        analyticsEventName="issue_views.save_as.clicked"
      >
        {t('Save As')}
      </Button>
    );
  }

  return (
    <SegmentedIssueViewSaveButton openCreateIssueViewModal={openCreateIssueViewModal} />
  );
}

const PrimarySaveButton = styled(Button)`
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
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  padding-left: ${space(1)};
  padding-right: ${space(1)};
  border-left: none;
`;
