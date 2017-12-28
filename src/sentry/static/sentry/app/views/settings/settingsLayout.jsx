import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from '../../components/inlineSvg';
import SettingsActivity from './components/settingsActivity';
import SettingsBreadcrumb from './components/settingsBreadcrumb';
import SettingsHeader from './components/settingsHeader';
import SettingsSearch from './components/settingsSearch';

const StyledIconCircleExclamation = styled(props => (
  <InlineSvg size="32" src="icon-circle-exclamation" {...props} />
))`
  color: ${p => p.theme.blue};
  opacity: 0.6;
`;

let StyledWarning = styled.div`
  margin: 30px 0;
  background: ${p => p.theme.alert.info.background};
  border: 1px solid ${p => p.theme.alert.info.border};
  padding: 15px 20px;
  border-radius: ${p => p.theme.borderRadius};
  line-height: ${p => p.theme.text.lineHeightBody};
  font-size: ${p => p.theme.text.size.small};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

// TODO(billy): Temp
let NewSettingsWarning = ({location = {}}) => {
  // TODO(billy): Remove this warning when ready
  let oldLocation = location.pathname
    ? location.pathname.replace(/^\/settings\/organization\//, '/organizations/')
    : '';

  //if (oldLocation === location.pathname) return null;

  // members or auth should not be react routes
  let isRouter = !/\/(members|auth)\//.test(location.pathname);
  let linkProps = {
    href: isRouter ? undefined : oldLocation,
    to: isRouter ? oldLocation : undefined,
  };
  let Component = isRouter ? Link : 'a';
  return (
    <StyledWarning>
      <Flex align="center">
        <Box w={32} mr={2}>
          <StyledIconCircleExclamation />
        </Box>
        <Box>
          These settings are currently in beta. Please report any issues. You can
          temporarily visit the <Component {...linkProps}>old settings page</Component> if
          necessary.
        </Box>
      </Flex>
    </StyledWarning>
  );
};

const Content = styled(Box)`
  flex: 1;
`;

class SettingsLayout extends React.Component {
  static propTypes = {
    renderNavigation: PropTypes.func,
    route: PropTypes.object,
    routes: PropTypes.array,
  };

  render() {
    let {params, routes, route, renderNavigation, children} = this.props;
    // We want child's view's props
    let childProps = (children && children.props) || this.props;
    let childRoutes = childProps.routes || routes || [];
    let childRoute = childProps.route || route || {};
    return (
      <div>
        <SettingsHeader>
          <Box flex="1">
            <SettingsBreadcrumb params={params} routes={childRoutes} route={childRoute} />
          </Box>
          <SettingsSearch params={params} />
        </SettingsHeader>
        <Flex>
          {typeof renderNavigation === 'function' && (
            <Box flex="0 0 210px">
              <StickySidebar>{renderNavigation()}</StickySidebar>
            </Box>
          )}
          <Content>
            {children}
            <NewSettingsWarning location={this.props.location} />
          </Content>
        </Flex>
        <SettingsActivity />
      </div>
    );
  }
}
const StickySidebar = styled.div`
  position: sticky;
  top: 105px;
`;

export default SettingsLayout;
