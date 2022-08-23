import React from 'react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import Hook from 'sentry/components/hook';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import SidebarDropdownMenu from './sidebarDropdownMenu.styled';
import SidebarMenuItem from './sidebarMenuItem';
import {CommonSidebarProps} from './types';

const getLearningItem = location => {
  const pathname: string = location.pathname;
  if (pathname.includes('/alerts/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=HVa_cvkckdc">
          {t('Learn: Metric Alerts')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=8zn1G2xtFrc">
          {t('Learn: Regression Alerts')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/issues/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=vxLgprHiqC0">
          {t('Learn: Issue Grouping')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=GVKqIpfD9mE">
          {t('Learn: Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/dashboards/')) {
    return (
      <SidebarMenuItem href="https://www.youtube.com/watch?v=j1nIV2K2XmI">
        {t('Learn: Build Dashboards')}
      </SidebarMenuItem>
    );
  }
  if (pathname.includes('/projects/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=Ra6Z_d-aKw8">
          {t('Learn: Fingerprint Rules')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=GVKqIpfD9mE">
          {t('Learn: Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/discover/')) {
    return (
      <SidebarMenuItem href="https://www.youtube.com/watch?v=Ra6Z_d-aKw8">
        {t('Learn: Fingerprint Rules')}
      </SidebarMenuItem>
    );
  }
  return null;
};

type Props = Pick<CommonSidebarProps, 'collapsed' | 'hidePanel' | 'orientation'> & {
  location?: any;
} & {
  organization: Organization;
};

const SidebarHelp = ({
  orientation,
  collapsed,
  hidePanel,
  location,
  organization,
}: Props) => (
  <DeprecatedDropdownMenu>
    {({isOpen, getActorProps, getMenuProps}) => (
      <HelpRoot>
        <HelpActor {...getActorProps({onClick: hidePanel})}>
          <SidebarItem
            data-test-id="help-sidebar"
            orientation={orientation}
            collapsed={collapsed}
            hasPanel={false}
            icon={<IconQuestion size="md" />}
            label={t('Help')}
            id="help"
          />
        </HelpActor>

        {isOpen && (
          <HelpMenu {...getMenuProps({})} orientation={orientation}>
            {getLearningItem(location)}
            <SidebarMenuItem
              data-test-id="search-docs-and-faqs"
              onClick={() => openHelpSearchModal({organization})}
            >
              {t('Search Support, Docs and More')}
            </SidebarMenuItem>
            <SidebarMenuItem href="https://help.sentry.io/">
              {t('Visit Help Center')}
            </SidebarMenuItem>
            <Hook name="sidebar:help-menu" organization={organization} />
          </HelpMenu>
        )}
      </HelpRoot>
    )}
  </DeprecatedDropdownMenu>
);

export default SidebarHelp;

const HelpRoot = styled('div')`
  position: relative;
`;

// This exists to provide a styled actor for the dropdown. Making the actor a regular,
// non-styled react component causes some issues with toggling correctly because of
// how refs are handled.
const HelpActor = styled('div')``;

const HelpMenu = styled('div', {shouldForwardProp: p => p !== 'orientation'})<{
  orientation: Props['orientation'];
}>`
  ${SidebarDropdownMenu};
  ${p => (p.orientation === 'left' ? 'bottom: 100%' : `top: ${space(4)}; right: 0px;`)}
`;
