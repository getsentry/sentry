import styled from '@emotion/styled';

import BulkController from 'app/components/bulkController';
import {PanelTable} from 'app/components/panels';
import Switch from 'app/components/switchButton';
import {LegacyBrowser} from 'app/types/dynamicSampling';

import Browser from './browser';

const legacyBrowsers = Object.values(LegacyBrowser) as Array<LegacyBrowser>;

type Props = {
  onChange: (selectedLegacyBrowsers: Array<LegacyBrowser>) => void;
  selectedLegacyBrowsers?: Array<LegacyBrowser>;
};

function LegacyBrowsersField({onChange, selectedLegacyBrowsers = []}: Props) {
  function handleChange({
    selectedIds,
  }: Parameters<NonNullable<BulkController['props']['onChange']>>[0]) {
    onChange(selectedIds as Array<LegacyBrowser>);
  }

  return (
    <BulkController
      pageIds={legacyBrowsers}
      defaultSelectedIds={selectedLegacyBrowsers}
      allRowsCount={legacyBrowsers.length}
      onChange={handleChange}
      columnsCount={0}
    >
      {({selectedIds, onRowToggle, onPageRowsToggle, isPageSelected}) => (
        <StyledPanelTable
          headers={[
            '',
            <Switch
              key="switch"
              size="lg"
              isActive={isPageSelected}
              toggle={() => {
                onPageRowsToggle(!isPageSelected);
              }}
            />,
          ]}
        >
          {legacyBrowsers.map(legacyBrowser => (
            <Browser
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
