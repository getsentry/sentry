import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type UnitTypeProps = {
  description: React.ReactNode;
  unitName: React.ReactNode;
  weight: string;
};

export default function UnitTypeItem({unitName, description, weight}: UnitTypeProps) {
  return (
    <UnitTypeContainer>
      <UnitColumn>
        <UnitName>{unitName}</UnitName>
        <UnitTitle>{t('Unit')}</UnitTitle>
      </UnitColumn>
      <UnitColumn>
        <Description>{description}</Description>
        <Weight>{weight}</Weight>
      </UnitColumn>
    </UnitTypeContainer>
  );
}

const UnitTypeContainer = styled(PanelItem)`
  display: grid;
  grid-auto-flow: row;
  gap: ${space(0.5)};
`;

const UnitColumn = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
`;

const UnitName = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: 0px;
  font-weight: normal;
  color: ${p => p.theme.subText};
`;

const UnitTitle = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  font-weight: 600;
`;

const Weight = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray500};
  align-self: start;
`;
