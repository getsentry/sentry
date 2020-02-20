import {Flex} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

type FlexComponentProps = Omit<React.ComponentPropsWithoutRef<typeof Flex>, 'theme'>;

type Props = FlexComponentProps & {
  disablePadding?: boolean; // deprecated
  withPadding?: boolean;
};

const PanelBody: React.FunctionComponent<Props> = (props: Props) => (
  <FlexBox {...props} />
);

PanelBody.propTypes = {
  disablePadding: PropTypes.bool, // deprecated
  withPadding: PropTypes.bool,
};

PanelBody.defaultProps = {
  withPadding: false,
  disablePadding: true,
};

const FlexBox = styled(Flex)<Props>`
  ${textStyles};
  ${p => !p.flex && 'display: block'};
  ${p => (p.withPadding || !p.disablePadding) && `padding: ${space(2)}`};
`;

export default PanelBody;
