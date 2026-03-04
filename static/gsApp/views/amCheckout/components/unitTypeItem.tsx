import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';

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
  gap: ${p => p.theme.space.xs};
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
  font-size: ${p => p.theme.font.size.lg};
`;

const Description = styled('p')`
  font-size: ${p => p.theme.font.size.md};
  margin-bottom: 0px;
  font-weight: normal;
  color: ${p => p.theme.tokens.content.secondary};
`;

const UnitTitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  text-transform: uppercase;
  font-weight: 600;
`;

const Weight = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  color: ${p => p.theme.colors.gray800};
  align-self: start;
`;
