import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
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
});
