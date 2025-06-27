import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function Drawer() {
  return (
    <DrawerContainer>
      <DrawerHeader hideBar />
      <StyledDrawerBody>
        <Title>{t('Suspect Attributes')}</Title>
        <SubTitle>
          {t(
            'Comparing selected and unselected (baseline) data, we sorted  attributes that differ the most in frequency. This indicates how suspicious they are. '
          )}
        </SubTitle>
        <span>TODO: Add suspect attributes</span>
      </StyledDrawerBody>
    </DrawerContainer>
  );
}

const Title = styled('h4')`
  margin: 0;
  flex-shrink: 0;
`;

const SubTitle = styled('span')``;

const StyledDrawerBody = styled(DrawerBody)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;

  > header {
    flex-shrink: 0;
  }
`;
