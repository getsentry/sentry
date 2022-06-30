import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import useUrlHash from 'sentry/utils/replays/hooks/useUrlHash';
import ReplayReader from 'sentry/utils/replays/replayReader';

import Breadcrumbs from './breadcrumbs';
import TagPanel from './tagPanel';

const TABS = {
  breadcrumbs: t('Breadcrumbs'),
  tags: t('Tags'),
};

type Props = {
  replay: ReplayReader | null;
};

function renderTabContent(key: string, loadedReplay: ReplayReader) {
  if (key === TABS.tags) {
    return <TagPanel replay={loadedReplay} />;
  }

  return <Breadcrumbs />;
}

function AsideTabs({replay}: Props) {
  const {getHashValue, setHashValue} = useUrlHash('t_side', TABS.breadcrumbs);
  const active = getHashValue();

  return (
    <Container>
      <NavTabs underlined>
        {Object.entries(TABS).map(([tab, label]) => {
          return (
            <li key={tab} className={active === tab ? 'active' : ''}>
              <a onClick={() => setHashValue(tab)}>{label}</a>
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

export default AsideTabs;
