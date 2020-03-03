import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import IssueList from 'app/components/issueList';
import space from 'app/styles/space';

type Props = {
  orgId: string;
  version: string;
};

const Issues = ({orgId, version}: Props) => {
  // cursor
  const issuesPath = `/organizations/${orgId}/issues/`;

  const query = {
    'first-release': version,
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

        <Button>{t('Open in Discover')}</Button>
      </ControlsWrapper>

      <TableWrapper>
        <IssueList
          endpoint={issuesPath}
          query={{
            ...query,
            query: 'first-release:"' + version + '"',
            limit: 5,
          }}
          statsPeriod="0"
          pagination={false}
          showActions={false}
          renderEmpty={() => (
            <Panel>
              <PanelBody>
                <PanelItem justifyContent="center">{t('No issues resolved')}</PanelItem>
              </PanelBody>
            </Panel>
          )}
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
`;

export default Issues;
