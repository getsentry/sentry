import styled from '@emotion/styled';

const FlexRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const FlexColumn = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const NonFlexDiv = styled('div')`
  padding: 10px;
`;

export default function () {
  return (
    <React.Fragment>
      <FlexRow>
        <span>Left</span>
        <span>Right</span>
      </FlexRow>
      <FlexColumn>
        <div>Top</div>
        <div>Bottom</div>
      </FlexColumn>
      <NonFlexDiv>Content</NonFlexDiv>
    </React.Fragment>
  );
}
