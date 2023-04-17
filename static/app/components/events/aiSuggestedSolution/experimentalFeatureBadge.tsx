import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function ExperimentalFeatureBadge() {
  return (
    <CenteredFeatureBadge
      tooltipProps={{containerDisplayMode: 'inline-flex'}}
      type="experimental"
      title={t(
        'This is an OpenAI generated solution that suggests a fix for this issue. Be aware that this may not be accurate.'
      )}
    />
  );
}

const CenteredFeatureBadge = styled(FeatureBadge)`
  span {
    height: ${space(2)};
    line-height: ${space(2)};
    span {
      padding-top: 1px;
    }
  }
`;
