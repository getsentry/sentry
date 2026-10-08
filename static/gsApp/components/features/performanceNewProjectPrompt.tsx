import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';

type Props = React.PropsWithChildren<{
  features: Organization['features'];
  organization: Organization;
}>;

export function PerformanceNewProjectPrompt({organization}: Props) {
  return (
    <Alert.Container>
      <Container marginTop="2xl">
        <Alert variant="info">
          <Flex
            align={{zero: 'start', '4xl': 'center'}}
            justify="between"
            direction={{zero: 'column', '4xl': 'row'}}
            gap="md"
          >
            {t(
              "Performance is available for your platform, but your organization's plan does not include performance monitoring."
            )}
            <Container flexShrink={0}>
              <Button
                size="sm"
                variant="primary"
                icon={<IconBusiness />}
                onClick={() =>
                  openUpsellModal({
                    organization,
                    source: 'feature.performance_new_project',
                  })
                }
              >
                {t('Learn More')}
              </Button>
            </Container>
          </Flex>
        </Alert>
      </Container>
    </Alert.Container>
  );
}
