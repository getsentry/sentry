import styled from '@emotion/styled';

import space from 'app/styles/space';

export const ChartControls = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

export const SubHeading = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: normal;
  color: ${p => p.theme.gray800};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  line-height: 1.3;
`;

export const SectionValue = styled('span')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
`;

export const InlineContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(2)};

  > h4 {
    margin-right: ${space(1)};
  }

  &:last-child {
    margin-right: 0;
  }
`;
