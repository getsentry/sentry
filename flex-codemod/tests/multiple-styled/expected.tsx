import {Flex} from '@sentry/scraps/layout';
import {Stack} from '@sentry/scraps/layout';
import styled from '@emotion/styled';





const NonFlexDiv = styled('div')`
  padding: 10px;
`;

export default function () {
  return (
    <React.Fragment>
      <Flex justify="space-between">
        <span>Left</span>
        <span>Right</span>
      </Flex>
      <Stack direction="column" align="start">
        <div>Top</div>
        <div>Bottom</div>
      </Stack>
      <NonFlexDiv>Content</NonFlexDiv>
    </React.Fragment>
  );
}
