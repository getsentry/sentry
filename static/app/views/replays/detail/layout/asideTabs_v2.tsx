import {Fragment} from 'react';

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
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

import {BreadcrumbSection, VideoSection} from './pageSections';

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

    const video = showVideo && (
      <VideoSection ref={fullscreenRef}>
        <ErrorBoundary mini>
          <ReplayView toggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
        </ErrorBoundary>
      </VideoSection>
    );

    const crumbs = showCrumbs && (
      <BreadcrumbSection>
        <ErrorBoundary mini>
          <Breadcrumbs />
        </ErrorBoundary>
      </BreadcrumbSection>
    );

    if (showVideo && showCrumbs) {
      return (
        <SplitPanel
          top={{
            content: video,
            default: '325px',
            min: 325,
          }}
          bottom={crumbs}
        />
      );
    }
    return (
      <Fragment>
        {video}
        {crumbs}
      </Fragment>
    );
  };

  return (
    <Fragment>
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
    </Fragment>
  );
}

export default AsideTabsV2;
