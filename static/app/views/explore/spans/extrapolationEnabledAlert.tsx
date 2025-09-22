import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
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
      <Alert type="warning">
        {tct('You have disabled extrapolation. [toggle]', {
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
