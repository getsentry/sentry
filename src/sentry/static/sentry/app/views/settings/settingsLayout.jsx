import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from '../../components/alert';
import Footer from '../../components/footer';
import SettingsBackButton from './components/settingsBackButton';
import SettingsBreadcrumb from './components/settingsBreadcrumb';
import SettingsHeader from './components/settingsHeader';
import SettingsSearch from './components/settingsSearch';

let StyledAlert = styled(Alert)`
  margin: 30px 0;
`;

// TODO(billy): Temp #NEW-SETTINGS
let NewSettingsWarning = ({location = {}}) => {
  // This translates current URLs back to "old" settings URLs
  // This is so that we can move from new settings back to old settings
  let projectRegex = /^\/settings\/organization\/([^\/]+)\/project\/([^\/]+)\//;
  let accountRegex = /^\/settings\/account\/([^\/]+)\//;
  let isProject = projectRegex.test(location.pathname);
  let isAccount = accountRegex.test(location.pathname);
  let oldLocation;

  if (isProject) {
    oldLocation = location.pathname.replace(projectRegex, '/$1/$2/settings/');
  } else if (isAccount) {
    oldLocation = location.pathname
      .replace(accountRegex, '/account/settings/$1/')
      .replace('details/', '')
      .replace('settings/close-account/', 'remove/')
      .replace('account/settings/api/', 'api/')
      .replace('auth-tokens/', '');
  } else {
    oldLocation = location.pathname.replace(
      /^\/settings\/organization\//,
      '/organizations/'
    );
  }

  // original org auth view and account settings are django views so we can't use react router navigation
  let isRouter = !/\/(auth|account)\//.test(location.pathname);
  let linkProps = {
    href: isRouter ? undefined : oldLocation,
    to: isRouter ? oldLocation : undefined,
  };
  let LinkWithFallback = isRouter ? Link : 'a';
  return (
    <StyledAlert type="info" icon="icon-circle-exclamation">
      These settings are currently in beta. Please report any issues. You can temporarily
      visit the <LinkWithFallback {...linkProps}>old settings page</LinkWithFallback> if
      necessary.
    </StyledAlert>
  );
};

const Container = styled(Flex)`
  max-width: ${p => p.theme.settings.containerWidth};
  margin: 0 auto;
  padding: 0 ${p => p.theme.grid * 2}px;
`;

const SidebarWrapper = styled(Box)`
  flex: 0 0 ${p => p.theme.settings.sidebarWidth};
`;

const Content = styled(Box)`
  flex: 1;
`;

const SettingsSubheader = styled.div`
  position: relative;
  z-index: ${p => p.theme.zIndex.dropdown};
  padding: ${p => p.theme.grid}px 0;
  margin-bottom: ${p => p.theme.grid * 3}px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.offWhite};
  font-size: 14px;
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
          <SettingsSubheader>
            <Container>
              <SettingsBackButton params={params}>Back to Project</SettingsBackButton>
            </Container>
          </SettingsSubheader>
          <Container>
            <Flex align="center" width={1}>
              <Box flex="1">
                <SettingsBreadcrumb
                  params={params}
                  routes={childRoutes}
                  route={childRoute}
                />
              </Box>
              <SettingsSearch params={params} />
            </Flex>
          </Container>
        </SettingsHeader>
        <Container>
          {typeof renderNavigation === 'function' && (
            <SidebarWrapper>
              <StickySidebar>{renderNavigation()}</StickySidebar>
            </SidebarWrapper>
          )}
          <Content>
            {children}
            <NewSettingsWarning location={this.props.location} />
          </Content>
        </Container>
        <Footer />
      </div>
    );
  }
}
const StickySidebar = styled.div`
  position: sticky;
  top: ${p => p.theme.settings.headerHeight};
`;

export default SettingsLayout;
