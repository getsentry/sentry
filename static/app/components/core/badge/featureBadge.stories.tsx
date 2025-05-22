import {Fragment} from 'react';

import {
  FeatureBadge,
  type FeatureBadgeProps,
} from 'sentry/components/core/badge/featureBadge';
import * as Storybook from 'sentry/stories';

export default Storybook.story('FeatureBadge', story => {
  story('Types', () => (
    <Storybook.SideBySide>
      <FeatureBadge type="alpha" />
      <FeatureBadge type="beta" />
      <FeatureBadge type="new" />
      <FeatureBadge type="experimental" />
    </Storybook.SideBySide>
  ));

  story('Variants', () => (
    <Fragment>
      <Storybook.PropMatrix<FeatureBadgeProps>
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
