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
`;

export const CardSectionHeading = styled(SectionHeading)`
  margin: 0px;
`;

export const StatNumber = styled('div')`
  font-size: 36px;
  margin: ${space(2)} 0px;
  color: ${p => p.theme.gray700};
`;

export const Description = styled('p')`
  font-size: 14px;
  margin: ${space(1)} 0px;
`;
