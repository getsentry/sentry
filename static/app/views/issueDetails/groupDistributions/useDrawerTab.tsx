import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';

const tabParser = parseAsStringLiteral(Object.values(DrawerTab)).withDefault(
  DrawerTab.TAGS
);

export function useDrawerTab({enabled}: {enabled: boolean}) {
  const [tab, setTab] = useQueryState('tab', tabParser);

  return enabled ? {tab, setTab} : {tab: DrawerTab.TAGS, setTab: (_tab: DrawerTab) => {}};
}
