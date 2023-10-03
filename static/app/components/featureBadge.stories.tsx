import {ComponentProps, Fragment} from 'react';

import FeatureBadge from 'sentry/components/featureBadge';
import Matrix from 'sentry/components/stories/matrix';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(FeatureBadge, story => {
  story('Types', () => (
    <SideBySide>
      <FeatureBadge type="alpha" />
      <FeatureBadge type="beta" />
      <FeatureBadge type="new" />
      <FeatureBadge type="experimental" />
    </SideBySide>
  ));

  story('Custom tooltip props', () => (
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

  story('variant', () => (
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
