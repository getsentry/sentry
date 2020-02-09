import {Flex} from 'reflexbox';
import React from 'react';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type FlexComponentProps = Omit<
  React.ComponentPropsWithoutRef<typeof Flex>,
  'theme' | 'flex'
>;

type Props = FlexComponentProps & {
  flex?: boolean;
  disablePadding?: boolean;
  direction?: FlexComponentProps['flexDirection'];
};

const PanelBody = ({
  direction = 'column',
  flex = false,
  disablePadding = true,
  ...props
}: Props) => (
  <FlexBox
    flex={flex}
    disablePadding={disablePadding}
    {...props}
    {...(flex && direction ? {flexDirection: direction} : null)}
  />
);

PanelBody.defaultProps = {
  flex: false,
  direction: 'column',
  disablePadding: true,
};

const FlexBox = styled(Flex, {shouldForwardProp: p => isPropValid(p) && p !== 'flex'})<
  Props
>`
  ${textStyles};
  ${p => !p.flex && 'display: block'};
  ${p => !p.disablePadding && `padding: ${space(2)}`};
`;

export default PanelBody;
