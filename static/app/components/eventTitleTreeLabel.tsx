import {Fragment} from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {TreeLabelPart} from 'sentry/types';
import {getTreeLabelPartDetails} from 'sentry/utils/events';

type Props = {
  treeLabel: TreeLabelPart[];
};

function EventTitleTreeLabel({treeLabel}: Props) {
  const firstFourParts = treeLabel.slice(0, 4);
  const remainingParts = treeLabel.slice(firstFourParts.length);

  return (
    <div>
      <FirstFourParts>
        {firstFourParts.map((part, index) => {
          const label = getTreeLabelPartDetails(part);
          if (index !== firstFourParts.length - 1) {
            return (
              <Fragment key={index}>
                <PriorityLabel>{label}</PriorityLabel>
                <Divider>{'|'}</Divider>
              </Fragment>
            );
          }
          return <PriorityLabel key={index}>{label}</PriorityLabel>;
        })}
      </FirstFourParts>
      {!!remainingParts.length && (
        <RemainingLabels>
          {remainingParts.map((part, index) => {
            const label = getTreeLabelPartDetails(part);
            return (
              <Fragment key={index}>
                <Divider>{'|'}</Divider>
                <Label>{label}</Label>
              </Fragment>
            );
          })}
        </RemainingLabels>
      )}
    </div>
  );
}

export default EventTitleTreeLabel;

const FirstFourParts = styled('div')`
  display: flex;
`;

const Label = styled('div')`
  display: inline-block;
`;

const PriorityLabel = styled(Label)`
  ${overflowEllipsis}
  display: inline-block;
`;

const RemainingLabels = styled('div')`
  ${overflowEllipsis}
  display: inline-block;
  min-width: 50px;
`;

export const Divider = styled('div')`
  color: ${p => p.theme.gray200};
  display: inline-block;
  padding: 0 ${space(1)};
`;
