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
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import {CreateIssueViewModal} from 'sentry/views/issueList/issueViews/createIssueViewModal';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

type IssueViewSaveButtonProps = {
  query: string;
  sort: IssueSortOptions;
};

export function IssueViewSaveButton({query, sort}: IssueViewSaveButtonProps) {
  const organization = useOrganization();
  const {viewId} = useParams();
  const {selection} = usePageFilters();

  const openCreateIssueViewModal = () => {
    openModal(props => (
      <CreateIssueViewModal
        {...props}
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

  // TODO: Check if the view has unsaved changes
  const isModified = true;
  const buttonPriority = isModified ? 'primary' : 'default';

  return (
    <ButtonBar merged>
      <PrimarySaveButton
        priority={buttonPriority}
        analyticsEventName="issue_views.save.clicked"
      >
        {t('Save')}
      </PrimarySaveButton>
      <DropdownMenu
        items={[
          {
            key: 'save-as',
            label: t('Save as new view'),
            onAction: () => {
              trackAnalytics('issue_views.save_as.clicked', {organization});
              openCreateIssueViewModal();
            },
          },
        ]}
        trigger={props => (
          <DropdownTrigger
            {...props}
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
`;
