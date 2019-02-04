import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import PanelBody from 'app/components/panels/panelBody';
import PanelHeader from 'app/components/panels/panelHeader';
import space from 'app/styles/space';

const Panel = styled(({title, body, dashedBorder, ...props}) => {
  const hasHeaderAndBody = !!title && !!body;

  return !hasHeaderAndBody ? (
    <div {...props} />
  ) : (
    <div {...props}>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>{body}</PanelBody>
    </div>
  );
})`
  background: ${p => (p.dashedBorder ? p.theme.offWhite : '#fff')};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px
    ${p => (p.dashedBorder ? 'dashed' + p.theme.gray2 : 'solid ' + p.theme.borderDark)};
  box-shadow: ${p => (p.dashedBorder ? 'none' : p.theme.dropShadowLight)};
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
  dashedBorder: PropTypes.bool,
};

export default Panel;
