import React, {useState} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';

import TagPanel from '../tagPanel';

import ResizePanel from './resizePanel';
import {VideoContainer} from '.';

const TABS = {
  video: t('Video Player'),
  tags: t('Tags'),
};

type Props = {};

function renderTabContent(key: string, loadedReplay: ReplayReader) {
  if (key === 'tags') {
    return <TagPanel replay={loadedReplay} />;
  }

  return <VideoContainer />;
}

function AsideTabsV2({}: Props) {
  const {replay} = useReplayContext();
  const [active, setActive] = useState<string>('video');

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
      <ResizePanel direction="s" style={{height: '325px'}}>
        <Container>
          {replay ? renderTabContent(active, replay) : <Placeholder height="100%" />}
        </Container>
      </ResizePanel>
    </React.Fragment>
  );
}

// TODO(replays): WIP 👇
const Container = styled('div')`
  height: 100%;
  min-height: 200px;
  max-height: calc(100vh - 70%);
`;

export default AsideTabsV2;
