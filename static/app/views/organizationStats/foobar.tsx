import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import space from 'sentry/styles/space';
// import Counter from 'remote/counter';

type Props = {};

function FooBar({}: Props) {
  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledLayoutTitle>Testing Webpack Federated Modules</StyledLayoutTitle>
      </Layout.HeaderContent>
      {/* <Counter /> */}
    </Layout.Header>
  );
}

export default FooBar;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;
