import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Sidebar from 'app/components/sidebar';
import Footer from 'app/components/footer';
import space from 'app/styles/space';

import SettingsBackButton from './settingsBackButton';
import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

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
        <Sidebar />
        <SettingsColumn>
          <SettingsHeader>
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
          </SettingsHeader>

          <MaxWidthContainer>
            {typeof renderNavigation === 'function' && (
              <SidebarWrapper>
                <SettingsBackButton params={params} />
                <SidebarWrapperContent>{renderNavigation()}</SidebarWrapperContent>
              </SidebarWrapper>
            )}
            <Content>{children}</Content>
          </MaxWidthContainer>
          <Footer />
        </SettingsColumn>
      </React.Fragment>
    );
  }
}

const MaxWidthContainer = styled('div')`
  display: flex;
  max-width: ${p => p.theme.settings.containerWidth};
  flex: 1;
`;

const SidebarWrapper = styled('div')`
  flex-shrink: 0;
  width: ${p => p.theme.settings.sidebarWidth};
  background: #fff;
  border-right: 1px solid ${p => p.theme.borderLight};
`;

const SidebarWrapperContent = styled('div')`
  padding: ${space(4)};
`;

const SettingsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1; /* so this stretches vertically so that footer is fixed at bottom */
  footer {
    margin-top: 0;
  }
`;

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
const Content = styled('div')`
  flex: 1;
  padding: ${space(4)};
  min-width: 0; /* keep children from stretching container */
`;

export default SettingsLayout;
