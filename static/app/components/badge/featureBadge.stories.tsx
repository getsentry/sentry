import type {ComponentProps} from 'react';
import {Fragment} from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import Matrix from 'sentry/components/stories/matrix';
import StoryBook from 'sentry/stories/storyBook';

export default StoryBook('FeatureBadge', Story => {
  Story('Types', () => (
    <Story.SideBySide>
      <FeatureBadge type="alpha" />
      <FeatureBadge type="beta" />
      <FeatureBadge type="new" />
      <FeatureBadge type="experimental" />
    </Story.SideBySide>
  ));

  Story('Custom tooltip props', () => (
    <Fragment>
      <FeatureBadge type="new" title="The tooltip title can be custom too" />
      <FeatureBadge
        type="new"
        tooltipProps={{
          title: 'You can use tooltipProps to override the title too',
        }}
      />
    </Fragment>
  ));

  Story('variant', () => (
    <Fragment>
      <p>
        When using an indicator you might want to position it manually using{' '}
        <kbd>styled(FeatureBadge)</kbd>.
      </p>
      <Matrix<ComponentProps<typeof FeatureBadge>>
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
