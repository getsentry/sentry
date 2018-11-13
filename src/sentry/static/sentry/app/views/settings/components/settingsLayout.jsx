import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Footer from 'app/components/footer';

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
            <Content>{children}</Content>
          </Container>
        </ContentContainerWrapper>
        <Footer />
      </React.Fragment>
    );
  }
}
export default SettingsLayout;

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
  margin-top: 7px;
`;

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
const Content = styled(Box)`
  flex: 1;
  min-width: 0; /* keep children from stretching container */
`;

const SettingsSubheader = styled('div')`
  position: relative;
  z-index: ${p => p.theme.zIndex.dropdown};
  padding: ${p => p.theme.grid}px 0;
  margin-bottom: ${p => p.theme.grid * 3}px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background: ${p => p.theme.offWhite};
  font-size: 14px;
`;
