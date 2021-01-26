import React from 'react';
import styled from '@emotion/styled';

import BulkController from 'app/components/bulkController';
import {PanelTable} from 'app/components/panels';
import Switch from 'app/components/switch';

import {LEGACY_BROWSER_LIST} from '../utils';

import LegacyBrowser from './legacyBrowser';

type Browser = React.ComponentProps<typeof LegacyBrowser>['browser'];

const legacyBrowsers = Object.keys(LEGACY_BROWSER_LIST) as Array<Browser>;

type Props = {
  onChange: (selectedLegacyBrowsers: Array<Browser>) => void;
};

function LegacyBrowsersField({onChange}: Props) {
  function handleChange({
    selectedIds,
  }: Parameters<NonNullable<BulkController['props']['onChange']>>[0]) {
    onChange(selectedIds as Array<Browser>);
  }

  return (
    <BulkController
      pageIds={legacyBrowsers}
      allRowsCount={legacyBrowsers.length}
      onChange={handleChange}
      columnsCount={0}
    >
      {({selectedIds, onRowToggle, onAllRowsToggle, isAllSelected}) => (
        <StyledPanelTable
          headers={[
            '',
            <Switch
              key="switch"
              size="lg"
              isActive={isAllSelected}
              toggle={() => {
                onAllRowsToggle(!isAllSelected);
              }}
            />,
          ]}
        >
          {legacyBrowsers.map(legacyBrowser => (
            <LegacyBrowser
              key={legacyBrowser}
              browser={legacyBrowser}
              isEnabled={selectedIds.includes(legacyBrowser)}
              onToggle={() => {
                onRowToggle(legacyBrowser);
              }}
            />
          ))}
        </StyledPanelTable>
      )}
    </BulkController>
  );
}

export default LegacyBrowsersField;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content;
  grid-column: 1 / -2;
`;
