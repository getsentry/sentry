import React from 'react';
import styled from '@emotion/styled';

import BulkController from 'app/components/bulkController';
import {PanelTable} from 'app/components/panels';
import Switch from 'app/components/switch';

import {LEGACY_BROWSER_LIST} from '../utils';

import LegacyBrowser from './legacyBrowser';

type Browser = keyof typeof LEGACY_BROWSER_LIST;

const legacyBrowsers = Object.keys(LEGACY_BROWSER_LIST) as Array<Browser>;

type Props = {
  onToggleAll: (isAllSelected: boolean) => void;
  onToggle: (browser: Browser) => void;
};

function LegacyBrowsersField({onToggleAll, onToggle}: Props) {
  return (
    <BulkController
      pageIds={legacyBrowsers}
      allRowsCount={legacyBrowsers.length}
      columnsCount={0}
    >
      {({selectedIds, onRowToggle, renderBulkNotice, onAllRowsToggle, isAllSelected}) => (
        <StyledPanelTable
          headers={[
            '',
            <Switch
              key="switch"
              size="lg"
              isActive={isAllSelected}
              toggle={() => {
                onAllRowsToggle(!isAllSelected);
                onToggleAll(!isAllSelected);
              }}
            />,
          ]}
        >
          {renderBulkNotice()}

          {legacyBrowsers.map(legacyBrowser => (
            <LegacyBrowser
              key={legacyBrowser}
              browser={legacyBrowser}
              isEnabled={selectedIds.includes(legacyBrowser)}
              onToggle={() => {
                onRowToggle(legacyBrowser);
                onToggle(legacyBrowser);
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
