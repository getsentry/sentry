import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

// This is required to offer components that sit between this settings header
// and i.e. dropdowns, some zIndex layer room
//
// e.g. app/views/settings/metric/triggers/chart/
const HEADER_Z_INDEX_OFFSET = 5;

const SettingsHeader = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header + HEADER_Z_INDEX_OFFSET};
  padding: ${space(2)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  height: ${p => p.theme.settings.headerHeight};
`;

export default SettingsHeader;
