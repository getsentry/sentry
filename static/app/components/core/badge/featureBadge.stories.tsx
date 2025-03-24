import {Fragment} from 'react';

import {
  FeatureBadge,
  type FeatureBadgeProps,
} from 'sentry/components/core/badge/featureBadge';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('FeatureBadge', story => {
  story('Types', () => (
    <SideBySide>
      <FeatureBadge type="alpha" />
      <FeatureBadge type="beta" />
      <FeatureBadge type="new" />
      <FeatureBadge type="experimental" />
    </SideBySide>
  ));

  story('Variants', () => (
    <Fragment>
      <Matrix<FeatureBadgeProps>
        render={props => (
          <span>
            Feature X
            <FeatureBadge {...props} />
          </span>
        )}
        propMatrix={{
          variant: ['badge', 'indicator', 'short'],
          type: ['alpha', 'beta', 'new', 'experimental'],
        }}
        selectedProps={['type', 'variant']}
      />
    </Fragment>
  ));
});
