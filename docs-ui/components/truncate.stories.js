import React from 'react';
import styled from '@emotion/styled';

import Truncate from 'app/components/truncate';

export default {
  title: 'Utilities/Truncate',
  component: Truncate,
};

export const TruncateAndExpandOnHover = () => (
  <div>
    <Wrapper position="start">
      <Truncate value="https://sentry.io/organizations/sentry/issues/" maxLength={30} />
    </Wrapper>
    <Wrapper position="end">
      <Truncate
        value="https://sentry.io/organizations/sentry/issues/"
        maxLength={30}
        leftTrim
        expandDirection="left"
      />
    </Wrapper>
  </div>
);

TruncateAndExpandOnHover.storyName = 'Truncate and Expand on Hover';

export const TruncateWithRegex = () => (
  <div>
    <Wrapper position="start">
      <Truncate
        value="https://sentry.io/organizations/sentry/issues/"
        maxLength={30}
        trimRegex={/\.|\//g}
      />
    </Wrapper>
    <Wrapper position="end">
      <Truncate
        value="https://sentry.io/organizations/sentry/issues/"
        maxLength={30}
        trimRegex={/\.|\//g}
        leftTrim
        expandDirection="left"
      />
    </Wrapper>
  </div>
);

TruncateWithRegex.storyName = 'Truncate with Regex';

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-${p => p.position || 'start'};
`;
