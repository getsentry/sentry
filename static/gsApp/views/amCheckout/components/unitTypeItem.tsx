import styled from '@emotion/styled';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';

type UnitTypeProps = {
  description: React.ReactNode;
  unitName: React.ReactNode;
  weight: string;
};

function UnitColumn({children}: {children: React.ReactNode}) {
  return (
    <Grid columns="auto max-content" justify="between" align="center" gap="3xl">
      {children}
    </Grid>
  );
}

export default function UnitTypeItem({unitName, description, weight}: UnitTypeProps) {
  return (
    <UnitTypeContainer>
      <UnitColumn>
        <Text size="lg" bold>
          {unitName}
        </Text>
        <Text size="sm" bold uppercase variant="muted">
          {t('Unit')}
        </Text>
      </UnitColumn>
      <UnitColumn>
        <Text variant="muted">{description}</Text>
        <Container alignSelf="start">
          <Text size="xl" bold variant="muted">
            {weight}
          </Text>
        </Container>
      </UnitColumn>
    </UnitTypeContainer>
  );
}

const UnitTypeContainer = styled(PanelItem)`
  display: grid;
  grid-auto-flow: row;
  gap: ${p => p.theme.space.xs};
`;
