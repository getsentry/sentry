import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import PanelBody from './panelBody';
import PanelHeader from './panelHeader';

const StyledPanel = styled.div`
  background: #fff;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: ${p => p.theme.grid * 4}px;
  position: relative;
`;

class Panel extends React.Component {
  static propTypes = {
    /**
     * When `title` and `body` are defined, use as children to `<PanelHeader>` and `<PanelBody>` respectively
     */
    title: PropTypes.node,
    body: PropTypes.node,
  };

  render() {
    let {title, body} = this.props;
    let hasHeaderAndBody = !!title && !!body;

    if (hasHeaderAndBody) {
      return (
        <StyledPanel>
          <PanelHeader>{title}</PanelHeader>

          <PanelBody>{body}</PanelBody>
        </StyledPanel>
      );
    }

    return <StyledPanel {...this.props} />;
  }
}

export default Panel;
