import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type FlexComponentProps = Omit<React.ComponentPropsWithoutRef<typeof Flex>, 'theme'>;

type Props = FlexComponentProps & {
  flexible?: boolean;
  withPadding?: boolean;
  flexDir?: FlexComponentProps['flexDirection'];
};

const PanelBody: React.FunctionComponent<Props> = ({flexDir, ...props}: Props) => (
  <FlexBox
    {...props}
    {...(props.flexible && flexDir ? {flexDirection: flexDir} : null)}
  />
);

PanelBody.propTypes = {
  flexible: PropTypes.bool,
  flexDir: PropTypes.any,
  withPadding: PropTypes.bool,
};

PanelBody.defaultProps = {
  flexible: false,
  flexDir: 'column',
  withPadding: false,
};

const FlexBox = styled(Flex)<Props>`
  ${textStyles};
  ${p => !p.flexible && 'display: block'};
  ${p => p.withPadding && `padding: ${space(2)}`};
`;

export default PanelBody;
