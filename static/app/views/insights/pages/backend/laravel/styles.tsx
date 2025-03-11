import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';

export const ModalChartContainer = styled('div')`
  height: 280px;
`;

export const ModalTableWrapper = styled(Panel)`
  margin-top: ${space(2)};
`;

export const WidgetFooterTable = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  font-size: ${p => p.theme.fontSizeSmall};

  & > * {
    padding: ${space(1)} ${space(0.5)};
  }

  & > *:nth-child(3n + 1) {
    padding-left: ${space(1.5)};
  }

  & > *:nth-child(3n + 2) {
    ${p => p.theme.overflowEllipsis};
    min-width: 0px;
  }

  & > *:nth-child(3n) {
    padding-right: ${space(2)};
    text-align: right;
  }

  & > *:not(:nth-last-child(-n + 3)) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

export const SeriesColorIndicator = styled('div')`
  width: 3px;
  height: 100%;
  flex-shrink: 0;
`;
