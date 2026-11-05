import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useQueryParamsExtrapolate,
  useSetQueryParamsExtrapolate,
} from 'sentry/views/explore/queryParams/context';

export function ExtrapolationEnabledAlert() {
  const organization = useOrganization();
  const extrapolate = useQueryParamsExtrapolate();
  const setExtrapolate = useSetQueryParamsExtrapolate();

  if (extrapolate) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="warning">
        {tct('You have disabled [extrapolation]. [toggle]', {
          extrapolation: (
            <ExternalLink href="https://docs.sentry.io/product/explore/trace-explorer/#how-sampling-affects-queries-in-trace-explorer">
              {t('extrapolation')}
            </ExternalLink>
          ),
          toggle: (
            <Button
              variant="link"
              onClick={() => {
                trackAnalytics('trace.explorer.extrapolation_toggled', {
                  organization,
                  organization_id: organization.id,
                  enabled: true,
                  source: 'enabled_alert',
                });
                setExtrapolate(true);
              }}
            >
              {t('Re-enable')}
            </Button>
          ),
        })}
      </Alert>
    </Alert.Container>
  );
}
