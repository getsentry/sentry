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
                <PriorityPart highlight={highlight}>{label}</PriorityPart>
                <Divider>{'|'}</Divider>
              </Fragment>
            );
          }
          return (
            <PriorityPart key={index} highlight={highlight}>
              {label}
            </PriorityPart>
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

const Wrapper = styled('span')`
  display: inline-grid;
  grid-template-columns: auto 1fr;
  align-items: center;
`;

const FirstFourParts = styled('span')`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
`;

const Label = styled('span')<{highlight: boolean}>`
  padding: ${space(0.25)} 0;
  ${p =>
    p.highlight &&
    `
      background: ${p.theme.alert.info.backgroundLight};
      border-radius: ${p.theme.borderRadius};
      padding: ${space(0.25)} ${space(0.5)};
    `}
`;

const PriorityPart = styled(Label)`
  ${overflowEllipsis}
`;

const RemainingLabels = styled('div')`
  ${overflowEllipsis}
  min-width: 50px;
`;

export const Divider = styled('span')`
  color: ${p => p.theme.gray200};
  display: inline-block;
  margin: 0 ${space(1)};
`;
