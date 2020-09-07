import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import PropTypes from 'prop-types';

import ScrollToTop from 'app/views/settings/components/scrollToTop';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';

type Props = {
  location: Location;
  organization?: Organization;
  project?: Project;
};

type State = {
  lastAppContext: 'project' | 'organization' | null;
};

class SettingsWrapper extends React.Component<Props, State> {
  static childContextTypes = {
    lastAppContext: PropTypes.oneOf(['project', 'organization']),
  };

  // save current context
  state: State = {
    lastAppContext: this.getLastAppContext(),
  };

  getChildContext() {
    return {
      lastAppContext: this.state.lastAppContext,
    };
  }

  getLastAppContext() {
    const {project, organization} = this.props;

    if (!!project) {
      return 'project';
    }

    if (!!organization) {
      return 'organization';
    }

    return null;
  }

  handleShouldDisableScrollToTop = (location: Location, prevLocation: Location) => {
    // we do not want to scroll to top when user just perform a search
    return (
      location.pathname === prevLocation.pathname &&
      location.query?.query !== prevLocation.query?.query
    );
  };

  render() {
    const {location, children} = this.props;

    return (
      <StyledSettingsWrapper>
        <ScrollToTop location={location} disable={this.handleShouldDisableScrollToTop}>
          {children}
        </ScrollToTop>
      </StyledSettingsWrapper>
    );
  }
}

export default SettingsWrapper;

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray800};
  margin-bottom: -${space(3)}; /* to account for footer margin top */
  line-height: 1;

  .messages-container {
    margin: 0;
  }
`;
