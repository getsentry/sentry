import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';

import styled from '@emotion/styled';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type FlexComponentProps = Omit<React.ComponentPropsWithoutRef<typeof Flex>, 'theme'>;

type Props = FlexComponentProps & {
  disablePadding?: boolean;
  direction?: FlexComponentProps['flexDirection'];
};

const PanelBody = ({direction, ...props}: Props) => (
  <FlexBox
    {...props}
    {...(props.flex && direction ? {flexDirection: direction} : null)}
  />
);

PanelBody.propTypes = {
  flex: PropTypes.bool,
  direction: PropTypes.string,
  disablePadding: PropTypes.bool,
};

PanelBody.defaultProps = {
  flex: false,
  direction: 'column',
  disablePadding: true,
};

const FlexBox = styled(Flex)<Props>`
  ${textStyles};
  ${p => !p.flex && 'display: block'};
  ${p => !p.disablePadding && `padding: ${space(2)}`};
`;

export default PanelBody;
