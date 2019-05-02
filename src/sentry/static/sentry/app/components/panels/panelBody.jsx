import {Flex} from 'grid-emotion';
import {css, cx} from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import space from 'app/styles/space';
import textStyles from 'app/styles/text';

const PanelBody = ({className, disablePadding, flex, direction, ...props}) => {
  const padding = !disablePadding
    ? css`
        padding: ${space(2)};
      `
    : '';
  const flexDirection = flex ? direction : undefined;
  const Comp = flex ? Flex : 'div';
  const textClassName = textStyles(props);

  return (
    <Comp
      className={cx(padding, textClassName, className)}
      {...props}
      direction={flexDirection}
    />
  );
};

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

export default PanelBody;
