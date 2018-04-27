import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import PanelBody from 'app/components/panels/panelBody';
import PanelHeader from 'app/components/panels/panelHeader';
import space from 'app/styles/space';

const StyledPanel = styled.div`
  background: #fff;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: ${space(3)};
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
