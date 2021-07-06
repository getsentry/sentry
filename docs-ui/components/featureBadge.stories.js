import styled from '@emotion/styled';

import FeatureBadge from 'app/components/featureBadge';

export default {
  title: 'Core/Tags/FeatureBadge',
  component: FeatureBadge,
};

export const Default = () => (
  <Wrapper>
    <FeatureBadge type="beta" />
    <FeatureBadge type="alpha" />
    <FeatureBadge type="new" />
  </Wrapper>
);

const Wrapper = styled('div')`
  display: grid;
`;
