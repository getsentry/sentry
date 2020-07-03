import {RouteComponentProps} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Button from 'app/components/button';
import {slideInLeft, fadeIn} from 'app/styles/animations';

import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

type Props = {
  renderNavigation?: () => React.ReactNode;
  children: React.ReactNode;
} & RouteComponentProps<{}, {}>;

class SettingsLayout extends React.Component<Props> {
  static propTypes = {
    renderNavigation: PropTypes.func,
    route: PropTypes.object,
    router: PropTypes.object,
    routes: PropTypes.array,
  };

  state = {
    /**
     * This is used when the screen is small enough that the navigation should
     * be hidden. On large screens this state will end up unused.
     */
    navVisible: false,
  };

  componentDidMount() {
    // Close the navigation when navigating. Only on small screens.
    this.unlisten = this.props.router.listen(() => this.toggleNav(false));
  }

  componentWillUnmount() {
    this.unlisten();
  }

  toggleNav(navVisible) {
    this.setState({navVisible});
    const bodyElement = document.getElementsByTagName('body')[0];

    // XXX(epurkhiser): The 'modal-open' class scroll-locks the body
    bodyElement.classList[navVisible ? 'add' : 'remove']('modal-open');
  }

  render() {
    const {params, routes, route, router, renderNavigation, children} = this.props;
    const {navVisible} = this.state;

    // We want child's view's props
    const childProps =
      children && React.isValidElement(children) ? children.props : this.props;
    const childRoutes = childProps.routes || routes || [];
    const childRoute = childProps.route || route || {};
    return (
      <React.Fragment>
        <SettingsColumn>
          <SettingsHeader>
            <HeaderContent>
              <NavMenuToggle
                priority="link"
                iconSize="16px"
                icon={navVisible ? 'icon-close' : 'icon-activity'}
                onClick={() => this.toggleNav(!navVisible)}
              />
              <StyledSettingsBreadcrumb
                params={params}
                routes={childRoutes}
                route={childRoute}
              />
              <SettingsSearch routes={routes} router={router} params={params} />
            </HeaderContent>
          </SettingsHeader>

          <MaxWidthContainer>
            {typeof renderNavigation === 'function' && (
              <SidebarWrapper isVisible={navVisible}>{renderNavigation()}</SidebarWrapper>
            )}
            <NavMask isVisible={navVisible} />
            <Content>{children}</Content>
          </MaxWidthContainer>
        </SettingsColumn>
      </React.Fragment>
    );
  }
}

const HeaderContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NavMask = styled('div')`
  display: none;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: ${p => (p.isVisible ? 'block' : 'none')};
    background: rgba(0, 0, 0, 0.35);
    height: 100%;
    width: 100%;
    position: absolute;
    z-index: 2;
    animation: ${fadeIn} 250ms ease-in-out;
  }
`;

const NavMenuToggle = styled(Button)`
  display: none;
  margin-right: ${space(2)};
  color: ${p => p.theme.gray5};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const MaxWidthContainer = styled('div')`
  display: flex;
  max-width: ${p => p.theme.settings.containerWidth};
  flex: 1;
`;

const SidebarWrapper = styled('div')`
  width: ${p => p.theme.settings.sidebarWidth};
  padding: ${space(4)};
  border-right: 1px solid ${p => p.theme.borderLight};
  background: #fff;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    animation: ${slideInLeft} 100ms ease-in-out;
    display: ${p => (p.isVisible ? 'block' : 'none')};
    position: absolute;
    z-index: 3;
    height: 100%;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
  }
`;

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;

const SettingsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1; /* so this stretches vertically so that footer is fixed at bottom */
  min-width: 0; /* fixes problem when child content stretches beyond layout width */
  footer {
    margin-top: 0;
  }
`;

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to
 * be cut off because it has negative margin.  Will also cut off tooltips.
 */

const Content = styled('div')`
  flex: 1;
  padding: ${space(4)};
  min-width: 0; /* keep children from stretching container */
`;

export default SettingsLayout;
