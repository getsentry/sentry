import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

import Link from '../../../components/link';
import SentryTypes from '../../../proptypes';
import recreateRoute from '../../../utils/recreateRoute';

import IconChevronRight from '../../../icons/icon-chevron-right';

class SettingsBreadcrumb extends React.Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    let {routes, params} = this.props;
    let routesWithNames = routes.filter(({name}) => name);
    let lastRouteIndex = routesWithNames.length - 1;
    return (
      <Breadcrumbs>
        {routesWithNames.map((route, i) => {
          let isLast = i === lastRouteIndex;

          return (
            <span key={`${route.name}:${route.path}`}>
              <Crumb to={recreateRoute(route, {routes, params})}>
                {route.name}{' '}
                {!isLast && (
                  <Divider>
                    <IconChevronRight size="15" />
                  </Divider>
                )}
                <Menu className="menu">
                  <MenuItem>Error, Inc.</MenuItem>
                  <MenuItem>RIP Industries</MenuItem>
                </Menu>
              </Crumb>
            </span>
          );
        })}
      </Breadcrumbs>
    );
  }
}

const Breadcrumbs = withTheme(
  styled.div`
    display: flex;
    align-items: center;
  `
);

const Crumb = styled(Link)`
  display: block;
  position: relative;
  font-size: 18px;
  color: ${p => p.theme.gray3};
  margin-right: 10px;
  cursor: pointer;
  > span {
    transition: 0.1s all ease;
  }

  &:hover {
    color: ${p => p.theme.gray5};
    > span {
      transform: rotate(90deg);
      top: 0;
    }

    > .menu {
      opacity: 1;
      visibility: visible;
    }
  }
`;

const Divider = styled.span`
  display: inline-block;
  margin-left: 6px;
  color: ${p => p.theme.gray1};
  position: relative;
  top: -1px;
`;

const Menu = styled.div`
  font-size: 16px;
  opacity: 0;
  visibility: hidden;
  position: absolute;
  top: 140%;
  width: 200px;
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  transition: 0.1s all ease;
  border-radius: ${p => p.theme.radius};
  overflow: hidden;
`;

const MenuItem = styled(Link)`
  display: block;
  padding: 15px;
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: none;
  }

  &:hover {
    background: ${p => p.theme.offWhite};
  }
`;

export default SettingsBreadcrumb;
