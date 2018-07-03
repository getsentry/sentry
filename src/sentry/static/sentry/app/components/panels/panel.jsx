import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import PanelBody from 'app/components/panels/panelBody';
import PanelHeader from 'app/components/panels/panelHeader';
import space from 'app/styles/space';

const Panel = styled(({title, body, ...props}) => {
  let hasHeaderAndBody = !!title && !!body;

  return !hasHeaderAndBody ? (
    <div {...props} />
  ) : (
    <div {...props}>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>{body}</PanelBody>
    </div>
  );
})`
  background: #fff;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: ${space(3)};
  position: relative;
`;

Panel.propTypes = {
  /**
   * When `title` and `body` are defined, use as children to `<PanelHeader>`
   * and `<PanelBody>` respectively.
   */
  title: PropTypes.node,
  body: PropTypes.node,
};

export default Panel;
