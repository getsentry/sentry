import React, {useState} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';

import TagPanel from '../tagPanel';

import ResizePanel from './resizePanel';
import {BreadCrumbsContainer, VideoContainer} from '.';

type Props = {
  showCrumbs?: boolean;
  showVideo?: boolean;
};

const TABS = {
  video: t('Replay'),
  tags: t('Tags'),
};

function AsideTabsV2({showCrumbs = true, showVideo = true}: Props) {
  const {replay} = useReplayContext();
  const [active, setActive] = useState<string>('video');

  const renderTabContent = (key: string, loadedReplay: ReplayReader) => {
    if (key === 'tags') {
      return <TagPanel replay={loadedReplay} />;
    }

    return (
      <React.Fragment>
        {showVideo ? (
          <ResizePanel direction="s" style={{height: '325px'}}>
            <Container>
              <VideoContainer />
            </Container>
          </ResizePanel>
        ) : null}

        {showCrumbs ? <BreadCrumbsContainer /> : null}
      </React.Fragment>
    );
  };

  return (
    <React.Fragment>
      <NavTabs underlined>
        {Object.entries(TABS).map(([tab, label]) => {
          return (
            <li key={tab} className={active === tab ? 'active' : ''}>
              <a onClick={() => setActive(tab)}>{label}</a>
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
