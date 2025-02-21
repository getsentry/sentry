import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  features: Organization['features'];
  organization: Organization;
}>;

function PerformanceNewProjectPrompt({organization}: Props) {
  return (
    <StyledAlert type="info" showIcon>
      <Container>
        {t(
          `Performance is available for your platform, but your organization's plan does not include performance monitoring.`
        )}
        <StyledButton
          size="sm"
          priority="primary"
          icon={<IconBusiness />}
          onClick={() =>
            openUpsellModal({
              organization,
              source: 'feature.performance_new_project',
            })
          }
        >
          {t('Learn More')}
        </StyledButton>
      </Container>
    </StyledAlert>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const StyledButton = styled(Button)`
  margin-left: ${space(1)};
  flex-shrink: 0;

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    margin-left: 0;
    margin-top: ${space(1)};
  }
`;

const StyledAlert = styled(Alert)`
  align-items: center;
  margin-top: ${space(3)};

  ${StyledButton} svg {
    color: ${p => p.theme.button.primary.color};
  }

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    align-items: flex-start;
  }
`;

export default PerformanceNewProjectPrompt;
