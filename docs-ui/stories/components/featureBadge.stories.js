import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';

export default {
  title: 'Components/Badges/Feature Badge',
  component: FeatureBadge,
};

export const Default = () => (
  <Wrapper>
    <FeatureBadge type="beta" />
    <FeatureBadge type="alpha" />
    <FeatureBadge type="new" />
  </Wrapper>
);

Default.storyName = 'Feature Badge';

const Wrapper = styled('div')`
  display: grid;
`;
