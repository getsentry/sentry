import {Fragment} from 'react';

import {IndexedMembersByProject} from 'sentry/actionCreators/members';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import StreamGroup from 'sentry/components/stream/group';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {Group} from 'sentry/types';

type Props = {
  error: boolean;
  issueCount: number;
  loading: boolean;
  memberList: IndexedMembersByProject | null;
  onCursor: CursorHandler;
  page: number;
  pageLinks: string;
  previewGroups: string[] | null;
};

const PreviewTable = ({
  previewGroups,
  memberList,
  pageLinks,
  onCursor,
  issueCount,
  page,
  loading,
  error,
}: Props) => {
  const renderBody = () => {
    if (loading) {
      return <LoadingIndicator />;
    }
    if (error || !memberList) {
      return (
        <EmptyStateWarning>
          <p>{t('No preview available')}</p>
        </EmptyStateWarning>
      );
    }
    return previewGroups?.map((id, index) => {
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
        />
      );
    });
  };

  const renderCaption = () => {
    if (loading || error || !previewGroups) {
      return null;
    }
    const pageIssues = page * 5 + previewGroups.length;
    return tct(`Showing [pageIssues] of [issueCount] issues`, {pageIssues, issueCount});
  };

  return (
    <Fragment>
      <Panel>
        <GroupListHeader withChart={false} />
        <PanelBody>{renderBody()}</PanelBody>
      </Panel>
      <Pagination
        pageLinks={pageLinks}
        onCursor={onCursor}
        caption={renderCaption()}
        disabled={loading}
      />
    </Fragment>
  );
};

export default PreviewTable;
