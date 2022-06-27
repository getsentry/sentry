import {useState} from 'react';
import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';

import Breadcrumbs from './breadcrumbs';
import TagPanel from './tagPanel';

type Props = {
  replay: ReplayReader | null;
};

const TABS = [t('Breadcrumbs'), t('Tags')];

function renderTabContent(key: string, loadedReplay: ReplayReader) {
  switch (key) {
    case 'breadcrumbs':
      return <Breadcrumbs />;
    case 'tags':
      return <TagPanel replay={loadedReplay} />;
    default:
      throw new Error('Sidebar tab not found');
  }
}

function TabbedAside({replay}: Props) {
  const [active, setActive] = useState<string>(TABS[0].toLowerCase());

  return (
    <Container>
      <NavTabs underlined>
        {TABS.map(tab => {
          const key = tab.toLowerCase();
          return (
            <li key={key} className={active === key ? 'active' : ''}>
              <a onClick={() => setActive(key)}>{tab}</a>
            </li>
          );
        })}
      </NavTabs>
      {replay ? renderTabContent(active, replay) : <Placeholder height="100%" />}
    </Container>
  );
}

// FYI: Since the Replay Player has dynamic height based
// on the width of the window,
// height: 0; will helps us to reset the height
// min-height: 100%; will helps us to grow at the same height of Player
const Container = styled('div')`
  width: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  height: 0;
  min-height: 100%;
  @media only screen and (max-width: ${p => p.theme.breakpoints.large}) {
    height: fit-content;
    max-height: 400px;
  }
`;

export default TabbedAside;
