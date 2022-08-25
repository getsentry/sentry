import React, {useMemo} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import DeprecatedDropdownMenu from 'sentry/components/deprecatedDropdownMenu';
import Hook from 'sentry/components/hook';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

import SidebarDropdownMenu from './sidebarDropdownMenu.styled';
import SidebarMenuItem from './sidebarMenuItem';
import {CommonSidebarProps} from './types';

const RANDOM_TITLES = [
  'Learn',
  // 'Educate Yo-self',
  // 'Need a Hand?',
  // 'Show Me',
  // 'Training',
  // 'Knowledge',
  // 'Enlighten Me',
];
const getRandomTitle = () => {
  return RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)];
};

const openYouTubeModal = (videoId: string) => {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
  openModal(
    () => (
      <React.Fragment>
        <iframe
          width="800"
          height="450"
          src={embedUrl}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </React.Fragment>
    ),
    {
      allowClickClose: false,
      modalCss: {name: 'youtube-embed-style', styles: 'padding: 0, margin: 0'},
    }
  );
};

const getLearningItem = location => {
  const pathname: string = location.pathname;
  if (pathname.includes('/alerts/')) {
    if (pathname.includes('/alerts/new/issue')) {
      return (
        <React.Fragment>
          <SidebarMenuItem
            data-test-id="learn-issue-alerts"
            onClick={() => openYouTubeModal('a3E96gap2hM')}
          >
            {t('Issue Alerts')}
          </SidebarMenuItem>
          <SidebarMenuItem
            data-test-id="learn-regression-alerts"
            onClick={() => openYouTubeModal('8zn1G2xtFrc')}
          >
            {t('Regression Alerts')}
          </SidebarMenuItem>
        </React.Fragment>
      );
    }

    if (pathname.includes('/alerts/new/metric')) {
      return (
        <SidebarMenuItem
          data-test-id="learn-metric-alerts"
          onClick={() => openYouTubeModal('HVa_cvkckdc')}
        >
          {t('Metric Alerts')}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem
        data-test-id="learn-alerts"
        href="https://docs.sentry.io/product/alerts/"
      >
        {t('Alerts')}
      </SidebarMenuItem>
    );
  }

  if (pathname.includes('/settings/')) {
    if (/settings.*ownership/.test(pathname)) {
      return (
        <SidebarMenuItem
          data-test-id="learn-issue-owners"
          onClick={() => openYouTubeModal('GVKqIpfD9mE')}
        >
          {t('Issue Owners')}
        </SidebarMenuItem>
      );
    }
    if (/settings.*filters/.test(pathname)) {
      return (
        <SidebarMenuItem href="https://docs.sentry.io/product/data-management-settings/filtering/">
          {t('Inbound Filters')}
        </SidebarMenuItem>
      );
    }
    if (/settings.*issue-grouping/.test(pathname)) {
      return (
        <SidebarMenuItem
          data-test-id="learn-issue-grouping"
          onClick={() => openYouTubeModal('Ra6Z_d-aKw8')}
        >
          {t('Issue Grouping')}
        </SidebarMenuItem>
      );
    }
    if (/settings.*security-and-privacy/.test(pathname)) {
      return (
        <SidebarMenuItem href="https://docs.sentry.io/product/data-management-settings/scrubbing/">
          {t('Security & Privacy')}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem href="https://help.sentry.io/account/#account-settings">
        {t('Settings')}
      </SidebarMenuItem>
    );
  }

  if (pathname.includes('/issues/')) {
    if (/issues\/\d+/.test(pathname)) {
      return (
        <SidebarMenuItem href="https://docs.sentry.io/product/issues/issue-details/">
          {t('Issue Details')}
        </SidebarMenuItem>
      );
    }
    return (
      <React.Fragment>
        <SidebarMenuItem
          data-test-id="learn-issue-review"
          onClick={() => openYouTubeModal('2njbTMh5huk')}
        >
          {t('Issues Review')}
        </SidebarMenuItem>
        <SidebarMenuItem
          data-test-id="learn-issues-grouping"
          onClick={() => openYouTubeModal('vxLgprHiqC0')}
        >
          {t('Issues Grouping')}
        </SidebarMenuItem>
        <SidebarMenuItem
          data-test-id="learn-ownership-rules"
          onClick={() => openYouTubeModal('GVKqIpfD9mE')}
        >
          {t('Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }

  if (pathname.includes('/performance/')) {
    return (
      <SidebarMenuItem
        data-test-id="learn-performance"
        onClick={() => openYouTubeModal('Ap5lQg7UL-s')}
      >
        {t('Performance')}
      </SidebarMenuItem>
    );
  }

  if (pathname.includes('/releases/')) {
    return (
      <SidebarMenuItem
        data-test-id="learn-releases"
        onClick={() => openYouTubeModal('fOd5vbf0U0w')}
      >
        {t('Releases')}
      </SidebarMenuItem>
    );
  }

  if (pathname.includes('/profiling/')) {
    return (
      <SidebarMenuItem
        data-test-id="learn-profiling"
        onClick={() => openYouTubeModal('A-I3e5XMCsQ')}
      >
        {t('Profiling')}
      </SidebarMenuItem>
    );
  }
  if (pathname.includes('/dashboards/')) {
    return (
      <SidebarMenuItem
        data-test-id="learn-dashboards"
        onClick={() => openYouTubeModal('j1nIV2K2XmI')}
      >
        {t('Build Dashboards')}
      </SidebarMenuItem>
    );
  }

  if (pathname.includes('/projects/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem
          data-test-id="learn-projects-figerpring-rules"
          onClick={() => openYouTubeModal('Ra6Z_d-aKw8')}
        >
          {t('Fingerprint Rules')}
        </SidebarMenuItem>
        <SidebarMenuItem
          data-test-id="learn-projects-ownership-rules"
          onClick={() => openYouTubeModal('GVKqIpfD9mE')}
        >
          {t('Ownership Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }

  if (pathname.includes('/discover/')) {
    return (
      <React.Fragment>
        <SidebarMenuItem
          data-test-id="learn-discover-queries"
          onClick={() => openYouTubeModal('Bw8DIaHScZ4')}
        >
          {t('Discover Queries')}
        </SidebarMenuItem>
        <SidebarMenuItem
          data-test-id="learn-discover-fingerprint-rules"
          onClick={() => openYouTubeModal('Ra6Z_d-aKw8')}
        >
          {t('Fingerprint Rules')}
        </SidebarMenuItem>
      </React.Fragment>
    );
  }

  return (
    <SidebarMenuItem href="https://sentry.io/resources/">
      {t('Resources')}
    </SidebarMenuItem>
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
                icon={<IconLab size="md" />}
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
