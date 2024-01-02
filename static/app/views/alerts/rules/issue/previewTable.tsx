import {Fragment} from 'react';
import styled from '@emotion/styled';

import {indexMembersByProject} from 'sentry/actionCreators/members';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import StreamGroup from 'sentry/components/stream/group';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {Group, Member} from 'sentry/types';

type Props = {
  error: string | null;
  isLoading: boolean;
  issueCount: number;
  members: Member[] | undefined;
  onCursor: CursorHandler;
  page: number;
  pageLinks: string;
  previewGroups: string[];
};

function PreviewTable({
  previewGroups,
  members,
  pageLinks,
  onCursor,
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
    if (issueCount === 0) {
      return (
        <EmptyStateWarning>
          <p>{t("We couldn't find any issues that would've triggered your rule")}</p>
        </EmptyStateWarning>
      );
    }
    const memberList = indexMembersByProject(members);
    return previewGroups.map((id, index) => {
      const group = GroupStore.get(id) as Group | undefined;

      return (
        <StreamGroup
          index={index}
          key={id}
          id={id}
          hasGuideAnchor={false}
          memberList={group?.project ? memberList[group.project.slug] : undefined}
          displayReprocessingLayout={false}
          useFilteredStats
          withChart={false}
          canSelect={false}
          showLastTriggered
        />
      );
    });
  };

  const renderCaption = () => {
    if (isLoading || error || !previewGroups) {
      return null;
    }
    const pageIssues = page * 5 + previewGroups.length;
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
      <Panel>
        <GroupListHeader
          withChart={false}
          withColumns={['assignee', 'event', 'lastTriggered', 'users']}
        />
        <PanelBody>{renderBody()}</PanelBody>
      </Panel>
      {renderPagination()}
    </Fragment>
  );
}

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

export default PreviewTable;
