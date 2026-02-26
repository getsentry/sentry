import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  organization: Organization;
}>;

function DisabledAlertWizard({organization}: Props) {
  return (
    <Flex justify="between" align="center" wrap="wrap">
      <Description>{t('Upgrade your plan to create this type of alert')}</Description>
      <Grid flow="column" align="center" gap="md">
        <Button
          onClick={() =>
            openUpsellModal({
              organization,
              source: 'alert-wizard',
            })
          }
        >
          {t('Learn More')}
        </Button>
        <Button priority="primary" disabled>
          {t('Set Conditions')}
        </Button>
      </Grid>
    </Flex>
  );
}

export default DisabledAlertWizard;

const Description = styled('div')`
  margin: ${space(1)} ${space(1)} ${space(1)} 0;
`;
