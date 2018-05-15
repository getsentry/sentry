import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';
import Footer from 'app/components/footer';
import space from 'app/styles/space';

import SettingsBackButton from './settingsBackButton';
import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

let StyledAlert = styled(Alert)`
  margin: ${space(3)} 0;
`;

// TODO(billy): Temp #NEW-SETTINGS
let NewSettingsWarning = ({location = {}}) => {
  // This translates current URLs back to "old" settings URLs
  // This is so that we can move from new settings back to old settings
  let projectRegex = /^\/settings\/([^\/]+)\/([^\/]+)\//;
  let accountRegex = /^\/settings\/account\/([^\/]+)\//;
  let orgSettingsIndex = /^\/settings\/([^\/]+)\/$/;
  let orgRegex = /^\/settings\/([^\/]+)\/(settings|projects|teams|stats|members|auth|api-keys|audit-log|rate-limits|repos|billing|payments|subscription|legal|support)\//;
  let isProject = projectRegex.test(location.pathname);
  let isOrgIndex = orgSettingsIndex.test(location.pathname);
  let isOrg = orgRegex.test(location.pathname);
  let isAccount = accountRegex.test(location.pathname);
  let oldLocation;

  if (isAccount) {
    oldLocation = location.pathname
      .replace(accountRegex, '/account/settings/$1/')
      .replace('details/', '')
      .replace('settings/close-account/', 'remove/')
      .replace('account/settings/api/', 'api/')
      .replace('auth-tokens/', '');
  } else if (isOrgIndex || isOrg || isProject) {
    return null;
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

// this wrapper is required, else content won't stretch horizontally
const ContentContainerWrapper = styled(Box)`
  flex: 1; /* so this stretches vertically so that footer is fixed at bottom */
`;

const SidebarWrapper = styled(Box)`
  flex-shrink: 0;
  width: ${p => p.theme.settings.sidebarWidth};
`;

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
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
    router: PropTypes.object,
    routes: PropTypes.array,
  };

  render() {
    let {params, routes, route, router, renderNavigation, children} = this.props;
    // We want child's view's props
    let childProps = (children && children.props) || this.props;
    let childRoutes = childProps.routes || routes || [];
    let childRoute = childProps.route || route || {};
    return (
      <React.Fragment>
        <SettingsHeader>
          <SettingsSubheader>
            <Container>
              <SettingsBackButton params={params} />
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
              <SettingsSearch routes={routes} router={router} params={params} />
            </Flex>
          </Container>
        </SettingsHeader>

        {/* this is div wrapper is required, else content won't stretch horizontally */}
        <ContentContainerWrapper>
          <Container>
            {typeof renderNavigation === 'function' && (
              <SidebarWrapper>{renderNavigation()}</SidebarWrapper>
            )}
            <Content>
              {children}
              <NewSettingsWarning location={this.props.location} />
            </Content>
          </Container>
        </ContentContainerWrapper>
        <Footer />
      </React.Fragment>
    );
  }
}
export default SettingsLayout;
