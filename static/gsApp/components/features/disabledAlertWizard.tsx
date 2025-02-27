import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  organization: Organization;
}>;

function DisabledAlertWizard({organization}: Props) {
  return (
    <Wrapper>
      <Description>{t('Upgrade your plan to create this type of alert')}</Description>
      <ButtonBar gap={1}>
        <Button
          onClick={() =>
            openUpsellModal({
              organization,
              source: 'alert-wizard',
              defaultSelection: 'integration-alerts',
            })
          }
        >
          {t('Learn More')}
        </Button>
        <Button priority="primary" disabled>
          {t('Set Conditions')}
        </Button>
      </ButtonBar>
    </Wrapper>
  );
}

export default DisabledAlertWizard;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
`;

const Description = styled('div')`
  margin: ${space(1)} ${space(1)} ${space(1)} 0;
`;
