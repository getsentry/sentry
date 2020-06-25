import {RouteComponentProps} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

type Props = {
  renderNavigation?: () => React.ReactNode;
  children: React.ReactNode;
} & RouteComponentProps<{}, {}>;

function SettingsLayout(props: Props) {
  const {params, routes, route, router, renderNavigation, children} = props;

  // We want child's view's props
  const childProps = children && React.isValidElement(children) ? children.props : props;
  const childRoutes = childProps.routes || routes || [];
  const childRoute = childProps.route || route || {};
  return (
    <React.Fragment>
      <SettingsColumn>
        <SettingsHeader>
          <HeaderContent>
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
            <SidebarWrapper>{renderNavigation()}</SidebarWrapper>
          )}
          <Content>{children}</Content>
        </MaxWidthContainer>
      </SettingsColumn>
    </React.Fragment>
  );
}

SettingsLayout.propTypes = {
  renderNavigation: PropTypes.func,
  route: PropTypes.object,
  router: PropTypes.object,
  routes: PropTypes.array,
};

const MaxWidthContainer = styled('div')`
  display: flex;
  max-width: ${p => p.theme.settings.containerWidth};
  min-width: 600px; /* for small screen sizes, we need a min width to make it semi digestible */
  flex: 1;
`;

const SidebarWrapper = styled('div')`
  flex-shrink: 0;
  width: ${p => p.theme.settings.sidebarWidth};
  background: ${p => p.theme.white};
  border-right: 1px solid ${p => p.theme.borderLight};
  padding: ${space(4)};
  padding-right: ${space(2)};
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: center;
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
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
const Content = styled('div')`
  flex: 1;
  padding: ${space(4)};
  min-width: 0; /* keep children from stretching container */
`;

export default SettingsLayout;
