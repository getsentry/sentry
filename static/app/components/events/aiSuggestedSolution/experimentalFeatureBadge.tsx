import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';

export function ExperimentalFeatureBadge() {
  return (
    <FeatureBadge
      size="sm"
      type="experimental"
      title={t(
        'This is an OpenAI generated solution that suggests a fix for this issue. Be aware that this may not be accurate.'
      )}
    />
  );
}
