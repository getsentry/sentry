import styled from '@emotion/styled';

import space from 'app/styles/space';

// This is required to offer components that sit between this settings header
// and i.e. dropdowns, some zIndex layer room
//
// e.g. app/views/settings/incidentRules/triggers/chart/
const HEADER_Z_INDEX_OFFSET = 5;

const SettingsHeader = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header + HEADER_Z_INDEX_OFFSET};
  padding: ${space(3)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
  background: #fff;
  height: ${p => p.theme.settings.headerHeight};
`;

export default SettingsHeader;
