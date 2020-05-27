import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import ScrollToTop from 'app/views/settings/components/scrollToTop';
import SentryTypes from 'app/sentryTypes';
import withLatestContext from 'app/utils/withLatestContext';

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
        : !!props.organization
        ? 'organization'
        : null,
    };
  }

  getChildContext() {
    return {
      lastAppContext: this.state.lastAppContext,
    };
  }

  shouldDisableScrollToTop(location, prevLocation) {
    // we do not want to scroll to top when user just perform a search
    return (
      location.pathname === prevLocation.pathname &&
      location.query?.query !== prevLocation.query?.query
    );
  }

  render() {
    return (
      <StyledSettingsWrapper>
        <ScrollToTop disable={this.shouldDisableScrollToTop}>
          {this.props.children}
        </ScrollToTop>
      </StyledSettingsWrapper>
    );
  }
}

export default withLatestContext(SettingsWrapper);

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: 16px;
  color: ${p => p.theme.gray800};
  margin-bottom: -20px; /* to account for footer margin top */
  line-height: 1;

  .messages-container {
    margin: 0;
  }
`;
