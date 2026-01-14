import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
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
      <ButtonBar>
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
      </ButtonBar>
    </Flex>
  );
}

export default DisabledAlertWizard;

const Description = styled('div')`
  margin: ${space(1)} ${space(1)} ${space(1)} 0;
`;
