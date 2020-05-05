import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Release, GlobalSelection} from 'app/types';
import Version from 'app/components/version';
import TimeSince from 'app/components/timeSince';
import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import EventView from 'app/utils/discover/eventView';
import {formatVersion} from 'app/utils/formatters';
import {getUtcDateString} from 'app/utils/dates';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  release: Release;
  orgSlug: string;
  selection: GlobalSelection;
};

const ProjectReleaseDetails = ({release, selection, orgSlug}: Props) => {
  const {version, dateCreated, firstEvent, lastEvent} = release;
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;

  const releaseQuery = EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: `${t('Release')} ${formatVersion(version)}`,
    fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
    query: `release:${version}`,
    orderby: '-last_seen',
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  }).getResultsViewUrlTarget(orgSlug);

  return (
    <Wrapper>
      <SectionHeading>{t('Project Release Details')}</SectionHeading>
      <StyledTable>
        <tbody>
          <StyledTr>
            <TagKey>{t('Created')}</TagKey>
            <TagValue>
              <DateTime date={dateCreated} seconds={false} />
            </TagValue>
          </StyledTr>

          <StyledTr>
            <TagKey>{t('Version')}</TagKey>
            <TagValue>
              <Link to={releaseQuery}>
                <Version version={version} anchor={false} />
              </Link>
            </TagValue>
          </StyledTr>

          <StyledTr>
            <TagKey>{t('First Event')}</TagKey>
            <TagValue>{firstEvent ? <TimeSince date={firstEvent} /> : '-'}</TagValue>
          </StyledTr>

          <StyledTr>
            <TagKey>{t('Last Event')}</TagKey>
            <TagValue>{lastEvent ? <TimeSince date={lastEvent} /> : '-'}</TagValue>
          </StyledTr>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
};

const StyledTable = styled('table')`
  width: 100%;
  max-width: 100%;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledTr = styled('tr')`
  &:nth-child(2n + 1) td {
    background-color: ${p => p.theme.offWhite};
  }
`;

const TagKey = styled('td')`
  color: ${p => p.theme.gray3};
  padding: ${space(0.5)} ${space(1)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagValue = styled(TagKey)`
  text-align: right;
  ${overflowEllipsis};
  min-width: 160px;
`;

export default ProjectReleaseDetails;
