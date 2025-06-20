import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import Panel from 'sentry/components/panels/panel';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  DetectorListRow,
  DetectorListRowSkeleton,
} from 'sentry/views/detectors/components/detectorListTable/detectorListRow';
import {DETECTOR_LIST_PAGE_LIMIT} from 'sentry/views/detectors/constants';

type DetectorListTableProps = {
  detectors: Detector[];
  isPending: boolean;
  sort: Sort | undefined;
};

function LoadingSkeletons() {
  return Array.from({length: DETECTOR_LIST_PAGE_LIMIT}).map((_, index) => (
    <DetectorListRowSkeleton key={index} />
  ));
}

function HeaderCell({
  children,
  name,
  divider,
  sortKey,
  sort,
}: {
  children: React.ReactNode;
  name: string;
  sort: Sort | undefined;
  divider?: boolean;
  sortKey?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSortedByField = sort?.field === sortKey;
  const handleSort = () => {
    if (!sortKey) {
      return;
    }
    const newSort =
      sort && isSortedByField ? `${sort.kind === 'asc' ? '-' : ''}${sortKey}` : sortKey;
    navigate({
      pathname: location.pathname,
      query: {...location.query, sort: newSort},
    });
  };

  return (
    <ColumnHeaderCell
      className={name}
      isSorted={isSortedByField}
      onClick={handleSort}
      role="columnheader"
      as={sortKey ? 'button' : 'div'}
    >
      {divider && <HeaderDivider />}
      {sortKey && <InteractionStateLayer />}
      <Heading>{children}</Heading>
      {sortKey && (
        <SortIndicator
          aria-hidden
          size="xs"
          direction={sort?.kind === 'asc' ? 'up' : 'down'}
          isSorted={isSortedByField}
        />
      )}
    </ColumnHeaderCell>
  );
}

function DetectorListTable({detectors, isPending, sort}: DetectorListTableProps) {
  return (
    <PanelGrid>
      <StyledPanelHeader>
        <HeaderCell name="name" sortKey="name" sort={sort}>
          {t('Name')}
        </HeaderCell>
        <HeaderCell name="type" divider sortKey="type" sort={sort}>
          {t('Type')}
        </HeaderCell>
        <HeaderCell name="issue" divider sort={sort}>
          {t('Last Issue')}
        </HeaderCell>
        <HeaderCell name="assignee" divider sort={sort}>
          {t('Assignee')}
        </HeaderCell>
        <HeaderCell
          name="connected-automations"
          divider
          sortKey="connectedWorkflows"
          sort={sort}
        >
          {t('Automations')}
        </HeaderCell>
      </StyledPanelHeader>
      <Fragment>
        {isPending ? (
          <LoadingSkeletons />
        ) : (
          detectors.map(detector => (
            <DetectorListRow key={detector.id} detector={detector} />
          ))
        )}
      </Fragment>
    </PanelGrid>
  );
}

const PanelGrid = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;

  .type,
  .creator,
  .last-issue,
  .connected-automations {
    display: none;
  }

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 3fr 0.8fr;

    .type {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .last-issue {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 3fr 0.8fr 1.5fr 0.8fr;

    .creator {
      display: flex;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: 4.5fr 0.8fr 1.5fr 0.8fr 2fr;

    .connected-automations {
      display: flex;
    }
  }
`;

const HeaderDivider = styled('div')`
  position: absolute;
  left: 0;
  background-color: ${p => p.theme.gray200};
  width: 1px;
  border-radius: ${p => p.theme.borderRadius};
  height: 14px;
`;

const Heading = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledPanelHeader = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: calc(${p => p.theme.borderRadius} + 1px)
    calc(${p => p.theme.borderRadius} + 1px) 0 0;
  justify-content: left;
  padding: 0;
  min-height: 40px;
  align-items: center;
  text-transform: none;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const ColumnHeaderCell = styled('div')<{isSorted?: boolean}>`
  background: none;
  outline: none;
  border: none;
  padding: 0 ${space(2)};
  text-transform: inherit;
  font-weight: ${p => p.theme.fontWeightBold};
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};

  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
  height: 100%;

  &:first-child {
    padding-left: ${space(4)};
  }

  ${p =>
    p.isSorted &&
    css`
      color: ${p.theme.textColor};
    `}
`;

const SortIndicator = styled(IconArrow, {
  shouldForwardProp: prop => prop !== 'isSorted',
})<{isSorted?: boolean}>`
  visibility: hidden;

  ${p =>
    p.isSorted &&
    css`
      visibility: visible;
    `}
`;

export default DetectorListTable;
