import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

import {VideoSection} from './pageSections';

type Props = {
  showCrumbs?: boolean;
  showVideo?: boolean;
};

function AsideTabsV2({showCrumbs = true, showVideo = true}: Props) {
  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();
  const {replay} = useReplayContext();

  const {getParamValue} = useUrlParams('t_side', 'video');
  const active = getParamValue();

  if (!replay) {
    return <Placeholder height="100%" />;
  }

  if (active === 'tags') {
    return <TagPanel replay={replay} />;
  }

  const video = showVideo && (
    <VideoSection ref={fullscreenRef}>
      <ErrorBoundary mini>
        <ReplayView toggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
      </ErrorBoundary>
    </VideoSection>
  );

  const crumbs = showCrumbs && (
    <ErrorBoundary mini>
      <Breadcrumbs />
    </ErrorBoundary>
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
}

export default AsideTabsV2;
