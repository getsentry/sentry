import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import GroupList from 'app/views/releases/detail/groupList';
import space from 'app/styles/space';
import {Panel} from 'app/components/panels';
import EventView from 'app/views/eventsV2/eventView';
import {formatVersion} from 'app/utils/formatters';

type Props = {
  orgId: string;
  version: string;
};

const Issues = ({orgId, version}: Props) => {
  // TODO(releasesV2): figure out the query we want + do we want to pass globalSelectionHeader values?
  const getDiscoverUrl = () => {
    const discoverQuery = {
      id: undefined,
      version: 2,
      name: `${t('Release')} ${formatVersion(version)}`,
      fields: ['title', 'count(id)', 'event.type', 'user', 'last_seen'],
      query: `release:${version}`,

      projects: [],
      range: '',
      start: '',
      end: '',
      environment: [''],
    } as const;

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(orgId);
  };

  return (
    <React.Fragment>
      <ControlsWrapper>
        <DropdownControl label="Resolved Issues">
          {[
            {value: 'new', label: t('New Issues')},
            {value: 'resolved', label: t('Resolved Issues')},
            {value: 'all', label: t('All Issues')},
          ].map((opt, index) => (
            <DropdownItem
              key={opt.value}
              onSelect={() => {}}
              eventKey={opt.value}
              isActive={index === 1}
            >
              {opt.label}
            </DropdownItem>
          ))}
        </DropdownControl>

        <Button to={getDiscoverUrl()}>{t('Open in Discover')}</Button>
      </ControlsWrapper>

      <TableWrapper>
        <GroupList
          orgId={orgId}
          // release:
          query={`first-release:"${version}"`}
          canSelectGroups={false}
          withChart={false}
        />
      </TableWrapper>
    </React.Fragment>
  );
};

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(3)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default Issues;
