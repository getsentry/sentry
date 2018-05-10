import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import ScrollToTop from 'app/views/settings/components/scrollToTop';
import SentryTypes from 'app/proptypes';
import withLatestContext from 'app/utils/withLatestContext';

const StyledSettingsWrapper = styled.div`
  font-family: 'Rubik', sans-serif;
  font-size: 16px;
  color: ${p => p.theme.gray5};
  margin: 0 auto;
  line-height: 1;

  footer > .container {
    max-width: ${p => p.theme.settings.containerWidth};
    padding: ${p => p.theme.grid * 2}px;
  }
`;

class SettingsWrapper extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
  };
  static childContextTypes = {
    lastAppContext: PropTypes.oneOf(['project', 'organization']),
  };

  constructor(props) {
    super(props);
    // save current context
    this.state = {
      lastAppContext: !!props.project
        ? 'project'
        : !!props.organization ? 'organization' : null,
    };
  }

  getChildContext() {
    return {
      lastAppContext: this.state.lastAppContext,
    };
  }

  componentDidMount() {
    $(document.body).addClass('new-settings');
  }

  componentWillUnmount() {
    $(document.body).removeClass('new-settings');
  }

  render() {
    return (
      <StyledSettingsWrapper>
        <ScrollToTop>{this.props.children}</ScrollToTop>
      </StyledSettingsWrapper>
    );
  }
}

export default withLatestContext(SettingsWrapper);
