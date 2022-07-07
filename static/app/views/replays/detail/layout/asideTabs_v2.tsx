import React from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import ReplayReader from 'sentry/utils/replays/replayReader';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';

import TagPanel from '../tagPanel';

import {BreadcrumbSection, VideoSection} from './pageSections';
import ResizePanel from './resizePanel';

type Props = {
  showCrumbs?: boolean;
  showVideo?: boolean;
};

const TABS = {
  video: t('Replay'),
  tags: t('Tags'),
};

function AsideTabsV2({showCrumbs = true, showVideo = true}: Props) {
  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();
  const {replay} = useReplayContext();

  const {getParamValue, setParamValue} = useUrlParams('t_side', 'video');
  const active = getParamValue();

  const renderTabContent = (key: string, loadedReplay: ReplayReader) => {
    if (key === 'tags') {
      return <TagPanel replay={loadedReplay} />;
    }

    return (
      <React.Fragment>
        {showVideo ? (
          <ResizePanel direction="s" style={{height: '325px'}}>
            <Container>
              <VideoSection ref={fullscreenRef}>
                <ErrorBoundary mini>
                  <ReplayView
                    toggleFullscreen={toggleFullscreen}
                    isFullscreen={isFullscreen}
                  />
                </ErrorBoundary>
              </VideoSection>
            </Container>
          </ResizePanel>
        ) : null}

        {showCrumbs ? (
          <BreadcrumbSection>
            <ErrorBoundary mini>
              <Breadcrumbs />
            </ErrorBoundary>
          </BreadcrumbSection>
        ) : null}
      </React.Fragment>
    );
  };

  return (
    <React.Fragment>
      <NavTabs underlined>
        {Object.entries(TABS).map(([tab, label]) => {
          return (
            <li key={tab} className={active === tab ? 'active' : ''}>
              <a onClick={() => setParamValue(tab)}>{label}</a>
            </li>
          );
        })}
      </NavTabs>
      {replay ? renderTabContent(active, replay) : <Placeholder height="100%" />}
    </React.Fragment>
  );
}

const Container = styled('div')`
  height: 100%;
  /* TODO(replays): calc max height so the user can't resize infinitely but always showing both elements */
  max-height: 50vh;
`;

export default AsideTabsV2;
