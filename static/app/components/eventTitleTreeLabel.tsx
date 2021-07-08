import {Fragment} from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

type Props = {
  treeLabel: string[];
};

function EventTitleTreeLabel({treeLabel}: Props) {
  const firstFourLabels = treeLabel.slice(0, 4);
  const remainingLabels = treeLabel.slice(firstFourLabels.length);

  return (
    <Wrapper>
      <FirstFourLabels>
        {firstFourLabels.map((label, index) => {
          if (index !== firstFourLabels.length - 1) {
            return (
              <Fragment key={index}>
                <PriorityLabel>{label}</PriorityLabel>
                <Divider>{'|'}</Divider>
              </Fragment>
            );
          }
          return <PriorityLabel key={index}>{label}</PriorityLabel>;
        })}
      </FirstFourLabels>
      {!!remainingLabels.length && (
        <RemainingLabels>
          {remainingLabels.map((label, index) => {
            return (
              <Fragment key={index}>
                <Divider>{'|'}</Divider>
                {label}
              </Fragment>
            );
          })}
        </RemainingLabels>
      )}
    </Wrapper>
  );
}

export default EventTitleTreeLabel;

const Wrapper = styled('span')`
  display: inline-grid;
  grid-template-columns: auto 1fr;
`;

const FirstFourLabels = styled('span')`
  display: grid;
  grid-auto-flow: column;
`;

const PriorityLabel = styled('div')`
  ${overflowEllipsis}
`;

const RemainingLabels = styled('div')`
  ${overflowEllipsis}
  min-width: 50px;
`;

const Divider = styled('span')`
  color: ${p => p.theme.gray200};
  display: inline-block;
  margin: 0 ${space(1)};
`;
