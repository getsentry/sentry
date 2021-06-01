import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openDiffModal} from 'app/actionCreators/modal';
import GroupingActions from 'app/actions/groupingActions';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Checkbox from 'app/components/checkbox';
import Confirm from 'app/components/confirm';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import Link from 'app/components/links/link';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {t, tct, tn} from 'app/locale';
import {Fingerprint} from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {getShortEventId} from 'app/utils/events';

import HeaderTitle from './headerTitle';

type Props = {
  organization: Organization;
  project: Project;
  groupId: Group['id'];
  location: Location;
  issues: Fingerprint[];
  pagination: string;
  enableCompareButton: boolean;
  selectedIssueIds: string[];
};

function MergedIssues({
  groupId,
  location,
  organization,
  project,
  issues,
  pagination,
  enableCompareButton,
  selectedIssueIds,
}: Props) {
  const orgSlug = organization.slug;

  function handleUnmerge() {
    const selectedIssueCount = selectedIssueIds.length;
    GroupingActions.unmerge({
      groupId,
      loadingMessage: tn(
        'Unmerging issue\u2026',
        'Unmerging issues\u2026',
        selectedIssueCount
      ),
      successMessage: tn(
        'Issue successfully unmerged',
        'Issues successfully unmerged',
        selectedIssueCount
      ),
      errorMessage: tn(
        'Unable to queue issue for unmerging',
        'Unable to queue issues for unmerging',
        selectedIssueCount
      ),
    });
  }

  function handleToggleAll() {
    if (!selectedIssueIds.length || selectedIssueIds.length === issues.length) {
      for (const issue of issues) {
        GroupingActions.toggleUnmerge([issue.id, issue.latestEvent.id]);
      }
      return;
    }

    const issuesToToggle = issues.filter(issue => !selectedIssueIds.includes(issue.id));
    for (const issueToToggle of issuesToToggle) {
      GroupingActions.toggleUnmerge([issueToToggle.id, issueToToggle.latestEvent.id]);
    }
  }

  function handleShowDiff(baseId: string, targetId: string) {
    const baseEventId = issues.find(issue => issue.id === baseId)?.latestEvent.id;
    const targetEventId = issues.find(issue => issue.id === targetId)?.latestEvent.id;

    if (!baseEventId || !targetEventId) {
      return;
    }

    openDiffModal({
      targetIssueId: groupId,
      project,
      baseIssueId: groupId,
      orgId: orgSlug,
      baseEventId,
      targetEventId,
    });
  }

  const actionsDisabled = issues.length <= 1;
  const unmergeDisabled = selectedIssueIds.length === 0;
  const compareDisabled = !enableCompareButton || selectedIssueIds.length !== 2;

  return (
    <Wrapper>
      <HeaderTitle>{tn('Merged Issue', 'Merged Issues', issues.length)}</HeaderTitle>
      {!actionsDisabled && (
        <Actions>
          <ButtonBar gap={1}>
            <Confirm
              disabled={unmergeDisabled}
              onConfirm={handleUnmerge}
              message={t(
                'These events will be unmerged and grouped into a new issue. Are you sure you want to unmerge these events?'
              )}
            >
              <Button
                priority="primary"
                size="small"
                title={
                  unmergeDisabled
                    ? t('The selection of two one more events is required')
                    : tct('Unmerging [unmergeCount] events', {
                        unmergeCount: selectedIssueIds.length,
                      })
                }
              >
                {t('Unmerge')}
              </Button>
            </Confirm>
            <Button
              size="small"
              disabled={compareDisabled}
              title={
                selectedIssueIds.length !== 2
                  ? t('The selection of exactly two events is required')
                  : undefined
              }
              onClick={() => handleShowDiff(selectedIssueIds[0], selectedIssueIds[1])}
            >
              {t('Compare')}
            </Button>
          </ButtonBar>
        </Actions>
      )}
      <StyledPanelTable
        isEmpty={!(issues.length > 0)}
        emptyMessage={t('No merged issue has been found')}
        headers={
          actionsDisabled
            ? [t('Issue Id'), t('Information'), t('Event count')]
            : [
                <Checkbox
                  key="bulk-checkbox"
                  checked={selectedIssueIds.length === issues.length}
                  onChange={handleToggleAll}
                />,
                t('Issue Id'),
                t('Information'),
                t('Event count'),
              ]
        }
      >
        {issues.map(({id, latestEvent, eventCount}) => (
          <Fragment key={id}>
            {!actionsDisabled && (
              <Column>
                <Checkbox
                  checked={selectedIssueIds.includes(id)}
                  onChange={() => {
                    GroupingActions.toggleUnmerge([id, latestEvent.id]);
                  }}
                />
              </Column>
            )}
            <EventIdColumn>
              <Tooltip title={t('View Event')}>
                <StyledLink
                  to={{
                    pathname: `/organizations/${orgSlug}/issues/${groupId}/events/${latestEvent.id}/`,
                    query: location.query,
                  }}
                >
                  {getShortEventId(id)}
                </StyledLink>
              </Tooltip>
            </EventIdColumn>
            <Column>
              <EventOrGroupHeader
                data={latestEvent}
                organization={organization}
                hideIcons
                hideLevel
              />
            </Column>
            <EventCount>{eventCount}</EventCount>
          </Fragment>
        ))}
      </StyledPanelTable>
      <Pagination pageLinks={pagination} />
    </Wrapper>
  );
}

export default MergedIssues;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(2)};
  align-items: center;
`;

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const StyledPanelTable = styled(PanelTable)`
  grid-column: 1 / -1;
  grid-template-columns: ${p =>
    p.headers.length === 4
      ? 'max-content max-content 1fr max-content'
      : 'max-content 1fr max-content'};
`;

const Column = styled('div')`
  display: flex;
  overflow: hidden;
`;

const EventCount = styled(Column)`
  justify-content: flex-end;
  align-items: center;
`;

const EventIdColumn = styled(Column)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledLink = styled(Link)`
  > div {
    display: inline;
  }
`;
