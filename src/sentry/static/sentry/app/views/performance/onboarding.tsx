import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconLightning} from 'app/icons';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';

function Onboarding() {
  return (
    <Panel>
      <Container>
        <IllustrationContainer>
          <IconLightning size="200px" />
        </IllustrationContainer>
        <StyledBox>
          <h3>{t('No transactions yet')}</h3>
          <p>
            {t(
              'View transactions sorted by slowest duration time, related issues, and number of users having a slow experience in one consolidated view. Trace those 10-second page loads to poor-performing API calls and its children.'
            )}
          </p>
          <Button
            priority="primary"
            target="_blank"
            href="https://docs.sentry.io/performance/distributed-tracing/#setting-up-tracing"
          >
            {t('Start Setup')}
          </Button>
        </StyledBox>
      </Container>
    </Panel>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  min-height: 450px;
  padding: ${space(1)};
`;

const StyledBox = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;

const IllustrationContainer = styled(StyledBox)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default Onboarding;
