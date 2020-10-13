import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import {PanelItem} from 'app/components/panels';
import space from 'app/styles/space';

export const Card = styled(PanelItem)`
  display: grid;
  grid-template-columns: 325px minmax(100px, auto);
  padding: 0;
`;

export const CardSection = styled('div')`
  padding: ${space(3)};
`;

export const CardSummary = styled(CardSection)`
  position: relative;
  border-right: 1px solid ${p => p.theme.borderLight};
  grid-column: 1/1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

export const CardSectionHeading = styled(SectionHeading)`
  margin: 0px;
`;

export const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
`;

export const StatNumber = styled('div')`
  font-size: 32px;
`;
