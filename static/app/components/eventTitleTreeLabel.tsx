import {Fragment} from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {TreeLabelPart} from 'app/types';
import {getTreeLabelPartDetails} from 'app/utils/events';

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
          const {label, highlight} = getTreeLabelPartDetails(part);
          if (index !== firstFourParts.length - 1) {
            return (
              <Fragment key={index}>
                <PriorityLabel highlight={highlight}>{label}</PriorityLabel>
                <Divider>{'|'}</Divider>
              </Fragment>
            );
          }
          return (
            <PriorityLabel key={index} highlight={highlight}>
              {label}
            </PriorityLabel>
          );
        })}
      </FirstFourParts>
      {!!remainingParts.length && (
        <RemainingLabels>
          {remainingParts.map((part, index) => {
            const {label, highlight} = getTreeLabelPartDetails(part);
            return (
              <Fragment key={index}>
                <Divider>{'|'}</Divider>
                <Label highlight={highlight}>{label}</Label>
              </Fragment>
            );
          })}
        </RemainingLabels>
      )}
    </Wrapper>
  );
}

export default EventTitleTreeLabel;

const Wrapper = styled('div')`
  display: inline-grid;
  grid-template-columns: auto 1fr;
  align-items: center;
`;

const FirstFourParts = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
`;

const Label = styled('div')<{highlight: boolean}>`
  ${p =>
    p.highlight &&
    `
      background: ${p.theme.alert.info.backgroundLight};
      border-radius: ${p.theme.borderRadius};
      padding: 0 ${space(0.5)};
    `}
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
