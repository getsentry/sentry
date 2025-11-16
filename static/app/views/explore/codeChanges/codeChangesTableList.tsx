import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Link} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types/user';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface PullRequest {
  author: string;
  authorUser: AvatarUser;
  coverage: string;
  downloadSize: string;
  id: string;
  number: number;
  status: string;
  timestamp: string;
  title: string;
  uncompressedSize: string;
}

interface CodeChangesTableListProps {
  pullRequestsData: PullRequest[];
}

type ColumnKey = 'pullRequest' | 'uncompressedSize' | 'downloadSize' | 'coverage';

const COLUMN_ORDER: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'pullRequest', name: t('Code Changes'), width: COL_WIDTH_UNDEFINED},
  {key: 'uncompressedSize', name: t('Uncompressed size'), width: 200},
  {key: 'downloadSize', name: t('Download size'), width: 200},
  {key: 'coverage', name: t('Patch coverage'), width: 180},
];

function renderTableHeader(
  column: GridColumnOrder<ColumnKey>,
  sort: {field: string; order: 'asc' | 'desc'} | null,
  onSortChange: (field: string, order: 'asc' | 'desc') => void,
  location: any,
  pullRequestStatus: string,
  setPullRequestStatus: (status: string) => void,
  pullRequestCounts: {closed: number; merged: number; open: number}
) {
  const {key, name} = column;
  const alignment =
    key === 'uncompressedSize' || key === 'downloadSize' || key === 'coverage'
      ? 'right'
      : 'left';

  const sortKey = String(key);
  const currentDirection = sort?.field === sortKey ? sort.order : undefined;
  const nextDirection = currentDirection === 'asc' ? 'desc' : 'asc';

  if (key === 'pullRequest') {
    return (
      <PullRequestHeaderContainer>
        <PullRequestTitleRow>
          <SortLink
            align={alignment}
            title={name}
            direction={currentDirection}
            canSort
            generateSortLink={() => ({
              ...location,
              query: {
                ...location.query,
                sort: `${nextDirection === 'desc' ? '-' : ''}${sortKey}`,
              },
            })}
            onClick={() => onSortChange(sortKey, nextDirection)}
          />
        </PullRequestTitleRow>
        <PullRequestControlRow>
          <SegmentedControl
            size="xs"
            value={pullRequestStatus}
            onChange={(value: string) => setPullRequestStatus(value)}
          >
            <SegmentedControl.Item key="open">
              {pullRequestCounts.open} Open
            </SegmentedControl.Item>
            <SegmentedControl.Item key="merged">
              {pullRequestCounts.merged} Merged
            </SegmentedControl.Item>
            <SegmentedControl.Item key="closed">
              {pullRequestCounts.closed} Closed
            </SegmentedControl.Item>
          </SegmentedControl>
        </PullRequestControlRow>
      </PullRequestHeaderContainer>
    );
  }

  return (
    <SortLink
      align={alignment}
      title={name}
      direction={currentDirection}
      canSort
      generateSortLink={() => ({
        ...location,
        query: {
          ...location.query,
          sort: `${nextDirection === 'desc' ? '-' : ''}${sortKey}`,
        },
      })}
      onClick={() => onSortChange(sortKey, nextDirection)}
    />
  );
}

function renderTableBody(
  column: GridColumnOrder<ColumnKey>,
  row: PullRequest,
  organization: any
) {
  const key = String(column.key);
  const alignment = ['uncompressedSize', 'downloadSize', 'coverage'].includes(key)
    ? 'right'
    : 'left';
  const pullUrl = `/organizations/${organization.slug}/explore/code-changes/${row.number}/`;

  if (key === 'pullRequest') {
    return (
      <StyledLink to={pullUrl}>
        <CommitCell>
          <UserAvatar user={row.authorUser} size={40} gravatar />
          <CommitInfo>
            <CommitMessage>{row.title}</CommitMessage>
            <CommitDetails>
              <AuthorName>{row.author}</AuthorName> opened{' '}
              <PullRequestLink
                href={`https://github.com/example-org/example-repo/pull/${row.number}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconGithub size="xs" />#{row.number}
              </PullRequestLink>{' '}
              • {row.timestamp}
            </CommitDetails>
          </CommitInfo>
        </CommitCell>
      </StyledLink>
    );
  }

  if (key === 'uncompressedSize') {
    return (
      <AlignmentContainer alignment={alignment}>
        {row.uncompressedSize}
      </AlignmentContainer>
    );
  }

  if (key === 'downloadSize') {
    return (
      <AlignmentContainer alignment={alignment}>{row.downloadSize}</AlignmentContainer>
    );
  }

  if (key === 'coverage') {
    return <AlignmentContainer alignment={alignment}>{row.coverage}</AlignmentContainer>;
  }

  return (
    <AlignmentContainer alignment={alignment}>{String(row[key])}</AlignmentContainer>
  );
}

export default function CodeChangesTableList({
  pullRequestsData,
}: CodeChangesTableListProps) {
  const organization = useOrganization();
  const location = useLocation();
  const [pullRequestStatus, setPullRequestStatus] = useState('open');
  const [pullsSort, setPullsSort] = useState<{
    field: string;
    order: 'asc' | 'desc';
  } | null>(null);

  // Sort handler
  const handlePullsSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setPullsSort({field, order});
  }, []);

  // Sort data function
  const sortData = useCallback(
    (data: PullRequest[], sort: {field: string; order: 'asc' | 'desc'} | null) => {
      if (!sort) return data;

      return [...data].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Handle different data types
        if (sort.field === 'pullRequest') {
          aValue = a.title;
          bValue = b.title;
        } else if (sort.field === 'coverage') {
          aValue = parseFloat(a.coverage) || 0;
          bValue = parseFloat(b.coverage) || 0;
        } else if (sort.field === 'uncompressedSize') {
          aValue = a.uncompressedSize;
          bValue = b.uncompressedSize;
        } else if (sort.field === 'downloadSize') {
          aValue = a.downloadSize;
          bValue = b.downloadSize;
        } else {
          return 0;
        }

        // Handle string comparisons
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sort.order === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        // Handle numeric comparisons
        if (sort.order === 'asc') {
          return aValue - bValue;
        }
        return bValue - aValue;
      });
    },
    []
  );

  // Apply sorting to data
  const sortedPullRequestsData = useMemo(() => {
    return sortData(pullRequestsData, pullsSort);
  }, [pullsSort, sortData, pullRequestsData]);

  // Filter pull requests by status
  const filteredPullRequests = useMemo(() => {
    const filtered = sortedPullRequestsData.filter(pr => pr.status === pullRequestStatus);
    return filtered;
  }, [pullRequestStatus, sortedPullRequestsData]);

  // Pull request status counts
  const pullRequestCounts = useMemo(() => {
    const counts = {open: 0, merged: 0, closed: 0};
    pullRequestsData.forEach(pr => {
      counts[pr.status as keyof typeof counts]++;
    });
    return counts;
  }, [pullRequestsData]);

  return (
    <GridEditable
      aria-label={t('Code Changes Table')}
      isLoading={false}
      data={filteredPullRequests}
      columnOrder={COLUMN_ORDER}
      columnSortBy={pullsSort ? [{key: pullsSort.field, order: pullsSort.order}] : []}
      isEditable
      grid={{
        renderHeadCell: (column: GridColumnOrder<ColumnKey>) =>
          renderTableHeader(
            column,
            pullsSort,
            handlePullsSortChange,
            location,
            pullRequestStatus,
            setPullRequestStatus,
            pullRequestCounts
          ),
        renderBodyCell: (
          column: GridColumnOrder<ColumnKey>,
          row: PullRequest,
          _rowIndex: number,
          _columnIndex: number
        ) => renderTableBody(column, row, organization),
      }}
    />
  );
}

// Styled Components
const AlignmentContainer = styled('div')<{alignment: string}>`
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};
`;

const CommitCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

const CommitInfo = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const CommitMessage = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xl};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const CommitDetails = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const AuthorName = styled('span')`
  font-weight: 600;
  color: ${p => p.theme.subText};
`;

const PullRequestLink = styled('a')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.linkColor};
  text-decoration: none;
  font-weight: ${p => p.theme.fontWeight.normal};

  &:hover {
    color: ${p => p.theme.linkHoverColor};
    text-decoration: underline;
  }

  &:visited {
    color: ${p => p.theme.linkColor};
  }
`;

const StyledLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  display: block;

  &:hover {
    color: inherit;
    text-decoration: none;
  }

  &:hover ${CommitCell} {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const PullRequestHeaderContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const PullRequestTitleRow = styled('div')`
  display: flex;
  align-items: center;
`;

const PullRequestControlRow = styled('div')`
  display: flex;
  align-items: center;
`;
