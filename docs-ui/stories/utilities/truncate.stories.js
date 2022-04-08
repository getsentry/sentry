import {Fragment} from 'react';
import styled from '@emotion/styled';

import Truncate from 'sentry/components/truncate';

export default {
  title: 'Utilities/Text/Truncate',
  component: Truncate,
};

export const TruncateAndExpandOnHover = () => (
  <Fragment>
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
  </Fragment>
);

TruncateAndExpandOnHover.storyName = 'Truncate and Expand on Hover';

export const TruncateWithRegex = () => (
  <Fragment>
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
  </Fragment>
);

TruncateWithRegex.storyName = 'Truncate with Regex';

const Wrapper = styled('div')`
  display: flex;
  justify-content: flex-${p => p.position || 'start'};
`;
