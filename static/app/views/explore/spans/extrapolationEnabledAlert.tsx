import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import {
  useQueryParamsExtrapolate,
  useSetQueryParamsExtrapolate,
} from 'sentry/views/explore/queryParams/context';

export function ExtrapolationEnabledAlert() {
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
            <Button priority="link" onClick={() => setExtrapolate(true)}>
              {t('Re-enable')}
            </Button>
          ),
        })}
      </Alert>
    </Alert.Container>
  );
}
