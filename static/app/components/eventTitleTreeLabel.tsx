import {Fragment} from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {TreeLabelPart} from 'app/types';
import {formatTreeLabelPart} from 'app/utils/events';

type Props = {
  treeLabel: TreeLabelPart[];
};

function EventTitleTreeLabel({treeLabel}: Props) {
  const firstFourParts = treeLabel.slice(0, 4);
  const remainingParts = treeLabel.slice(firstFourParts.length);

  return (
    <Wrapper>
      <FirstFourParts>
        {firstFourParts.map((part, index) => {
          if (index !== firstFourParts.length - 1) {
            return (
              <Fragment key={index}>
                <PriorityPart>{formatTreeLabelPart(part)}</PriorityPart>
                <Divider>{'|'}</Divider>
              </Fragment>
            );
          }
          return <PriorityPart key={index}>{formatTreeLabelPart(part)}</PriorityPart>;
        })}
      </FirstFourParts>
      {!!remainingParts.length && (
        <RemainingLabels>
          {remainingParts.map((part, index) => {
            return (
              <Fragment key={index}>
                <Divider>{'|'}</Divider>
                {formatTreeLabelPart(part)}
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

const FirstFourParts = styled('span')`
  display: grid;
  grid-auto-flow: column;
`;

const PriorityPart = styled('div')`
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
