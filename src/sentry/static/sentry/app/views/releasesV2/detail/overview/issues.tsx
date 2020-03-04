import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import GroupList from 'app/views/releases/detail/groupList';
import space from 'app/styles/space';
import {Panel} from 'app/components/panels';

type Props = {
  orgId: string;
  version: string;
};

const Issues = ({orgId, version}: Props) => {
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

        <Button>{t('Open in Discover')}</Button>
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
