import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type FlexComponentProps = Omit<React.ComponentPropsWithoutRef<typeof Flex>, 'theme'>;

type Props = FlexComponentProps & {
  flexible?: boolean;
  disablePadding?: boolean; // deprecated
  withPadding?: boolean;
};

const PanelBody: React.FunctionComponent<Props> = (props: Props) => (
  <FlexBox {...props} />
);

PanelBody.propTypes = {
  flexible: PropTypes.bool,
  disablePadding: PropTypes.bool, // deprecated
  withPadding: PropTypes.bool,
};

PanelBody.defaultProps = {
  flexible: false,
  withPadding: false,
  disablePadding: true,
};

const FlexBox = styled(Flex)<Props>`
  ${textStyles};
  ${p => !p.flexible && 'display: block'};
  ${p => (p.withPadding || !p.disablePadding) && `padding: ${space(2)}`};
`;

export default PanelBody;
