import {Fragment} from 'react';
import styled from '@emotion/styled';

import {indexMembersByProject} from 'sentry/actionCreators/members';
import type {AssignableEntity} from 'sentry/components/assigneeSelectorDropdown';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import StreamGroup from 'sentry/components/stream/group';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Member} from 'sentry/types/organization';

type Props = {
  error: string | null;
  groups: Group[];
  isLoading: boolean;
  issueCount: number;
  members: Member[] | undefined;
  onAssigneeChange: (groupId: string, newAssignee: AssignableEntity | null) => void;
  onCursor: CursorHandler;
  page: number;
  pageLinks: string;
};

function PreviewTable({
  groups,
  members,
  pageLinks,
  onCursor,
  onAssigneeChange,
  issueCount,
  page,
  isLoading,
  error,
}: Props) {
  const renderBody = () => {
    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (error || !members) {
      return (
        <EmptyStateWarning>
          <p>{error ? error : t('No preview available')}</p>
        </EmptyStateWarning>
      );
    }
    if (groups.length === 0) {
      return (
        <EmptyStateWarning>
          <p>{t("We couldn't find any issues that would've triggered your rule")}</p>
        </EmptyStateWarning>
      );
    }
    const memberList = indexMembersByProject(members);
    return groups.map(group => (
      <StreamGroup
        key={group.id}
        group={group}
        hasGuideAnchor={false}
        memberList={group.project ? memberList[group.project.slug] : undefined}
        displayReprocessingLayout={false}
        useFilteredStats
        withChart={false}
        canSelect={false}
        showLastTriggered
        withColumns={['assignee', 'event', 'lastTriggered', 'users']}
        onAssigneeChange={newAssignee => onAssigneeChange(group.id, newAssignee)}
      />
    ));
  };

  const renderCaption = () => {
    if (isLoading || error || !groups) {
      return null;
    }
    const pageIssues = page * 5 + groups.length;
    return tct(`Showing [pageIssues] of [issueCount] issues`, {pageIssues, issueCount});
  };

  const renderPagination = () => {
    if (error) {
      return null;
    }
    return (
      <StyledPagination
        pageLinks={pageLinks}
        onCursor={onCursor}
        caption={renderCaption()}
        disabled={isLoading}
      />
    );
  };

  return (
    <Fragment>
      <PanelContainer>
        <GroupListHeader
          withChart={false}
          withColumns={['assignee', 'event', 'lastTriggered', 'users']}
        />
        <PanelBody>{renderBody()}</PanelBody>
      </PanelContainer>
      {renderPagination()}
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const PanelContainer = styled(Panel)`
  container-type: inline-size;
`;

export default PreviewTable;
