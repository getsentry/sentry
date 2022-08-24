import React, {useMemo} from 'react';
import styled from '@emotion/styled';

import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import Hook from 'sentry/components/hook';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import SidebarDropdownMenu from './sidebarDropdownMenu.styled';
import SidebarMenuItem from './sidebarMenuItem';
import {CommonSidebarProps} from './types';

const RANDOM_TITLES = [
  'Learn',
  'Tutor Time',
  'Cheat Sheet',
  'Educate Yo-self',
  'Need a Hand?',
  'Quick and Painless',
  'Show Me',
];
const getRandomTitle = () => {
  return RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)];
};

const getLearningItem = location => {
  const pathname: string = location.pathname;
  if (pathname.includes('/alerts/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=HVa_cvkckdc">
          {t('Metric Alerts')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=8zn1G2xtFrc">
          {t('Regression Alerts')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/issues/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=vxLgprHiqC0">
          {t('Issue Grouping')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=GVKqIpfD9mE">
          {t('Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/dashboards/')) {
    return (
      <SidebarMenuItem href="https://www.youtube.com/watch?v=j1nIV2K2XmI">
        {t('Build Dashboards')}
      </SidebarMenuItem>
    );
  }
  if (pathname.includes('/projects/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=Ra6Z_d-aKw8">
          {t('Fingerprint Rules')}
        </SidebarMenuItem>
        <SidebarMenuItem href="https://www.youtube.com/watch?v=GVKqIpfD9mE">
          {t('Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }
  if (pathname.includes('/discover/')) {
    return (
      <SidebarMenuItem href="https://www.youtube.com/watch?v=Ra6Z_d-aKw8">
        {t('Fingerprint Rules')}
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem href="https://docs.sentry.io/">{t('Documentation')}</SidebarMenuItem>
  );
};

type Props = Pick<CommonSidebarProps, 'collapsed' | 'hidePanel' | 'orientation'> & {
  location?: any;
} & {
  organization: Organization;
};

const SidebarLearn = ({
  orientation,
  collapsed,
  hidePanel,
  location,
  organization,
}: Props) => {
  const randomTitle = useMemo(getRandomTitle, [location]);
  const learningItem = getLearningItem(location);
  return (
    learningItem && (
      <DeprecatedDropdownMenu>
        {({isOpen, getActorProps, getMenuProps}) => (
          <LearnRoot>
            <LearnActor {...getActorProps({onClick: hidePanel})}>
              <SidebarItem
                data-test-id="learn-sidebar"
                orientation={orientation}
                collapsed={collapsed}
                hasPanel={false}
                icon={<IconSentry size="md" />}
                // icon={<FontAwesomeIcon icon="graduation-cap" />}
                label={t(randomTitle)}
                id="learn"
              />
            </LearnActor>

            {isOpen && (
              <LearnMenu {...getMenuProps({})} orientation={orientation}>
                {getLearningItem(location)}
                <Hook name="sidebar:learn-menu" organization={organization} />
              </LearnMenu>
            )}
          </LearnRoot>
        )}
      </DeprecatedDropdownMenu>
    )
  );
};

export default SidebarLearn;

const LearnRoot = styled('div')`
  position: relative;
`;

// This exists to provide a styled actor for the dropdown. Making the actor a regular,
// non-styled react component causes some issues with toggling correctly because of
// how refs are handled.
const LearnActor = styled('div')``;

const LearnMenu = styled('div', {shouldForwardProp: p => p !== 'orientation'})<{
  orientation: Props['orientation'];
}>`
  ${SidebarDropdownMenu};
  ${p => (p.orientation === 'left' ? 'bottom: 100%' : `top: ${space(4)}; right: 0px;`)}
`;
