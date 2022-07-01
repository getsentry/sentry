import {useState} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';

import TagPanel from '../tagPanel';

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
    <Container>
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
    </Container>
  );
}

// FYI: height: 0; will helps us to reset the height
// min-height: 300 will helps us to start at some height, making our breadcrumbs to not overlap
const Container = styled('div')`
  height: 0;
  min-height: 300px;
`;

export default AsideTabsV2;
