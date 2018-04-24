import React from 'react';
import createReactClass from 'create-react-class';
import {Flex, Box} from 'grid-emotion';
import styled from 'react-emotion';

import space from '../../styles/space';

import OrganizationState from '../../mixins/organizationState';

import DropdownLink from '../../components/dropdownLink';
import MenuItem from '../../components/menuItem';
import {t} from '../../locale';
import Button from '../../components/buttons/button';
import Tooltip from '../../components/tooltip';

const ProjectNav = createReactClass({
  mixins: [OrganizationState],

  render() {
    const org = this.getOrganization();
    const access = this.getAccess();
    const hasProjectWrite = access.has('project:write');
    const hasTeamWrite = access.has('team:write');

    const menuItems = [
      {
        title: t('Project'),
        to: `/organizations/${org.slug}/projects/new/`,
        disabled: !hasProjectWrite,
        tooltip: t('You do not have permission to create new projects'),
      },
      {
        title: t('Team'),
        to: `/organizations/${org.slug}/teams/new/`,
        disabled: !hasTeamWrite,
        tooltip: t('You do not have permission to create new teams'),
      },
      {
        title: t('Teammate'),
        to: `settings/${org.slug}/members/new/`,
        disabled: !hasTeamWrite,
        tooltip: t('You do not have permission to manage teams'),
      },
    ];

    const menuContent = menuItems.reduce((acc, item, idx) => {
      if (idx > 0) {
        acc.push(<MenuItem key={idx} divider />);
      }
      if (item.disabled) {
        acc.push(
          <li role="presentation" key={item.title} disabled>
            <Tooltip title={item.tooltip}>
              <span>{item.title}</span>
            </Tooltip>
          </li>
        );
      } else {
        acc.push(
          <MenuItem
            title={item.title}
            to={item.to}
            key={item.title}
            disabled={item.disabled}
          >
            {item.title}
          </MenuItem>
        );
      }

      return acc;
    }, []);

    const title = (
      <Button size="small">
        <span>{t('Add new')}</span>
        <span className="icon-arrow-down" />
      </Button>
    );

    return (
      <StyledNav justify="space-between" p={2} align="center">
        <Box>
          <strong>{t('Projects')}</strong>
        </Box>
        <StyledDropdown>
          <DropdownLink title={title} anchorRight={true} caret={false}>
            {menuContent}
          </DropdownLink>
        </StyledDropdown>
      </StyledNav>
    );
  },
});

const StyledNav = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  box-shadow: ${p => p.theme.dropShadowLight};
  background-color: white;
`;

const StyledDropdown = styled.div`
  .dropdown-menu:after,
  .dropdown-menu:before {
    display: none;
  }
  .icon-arrow-down {
    top: 1px;
    font-size: 12px !important;
    color: ${p => p.theme.gray1};
    margin-left: ${space(0.5)};
  }
  li[role='presentation'] a:hover {
    color: white;
    background-color: ${p => p.theme.purpleDark};
  }
  li[disabled] {
    color ${p => p.theme.gray1};
    padding: 3px 10px;
  }
`;

export default ProjectNav;
