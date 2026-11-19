import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {DISTRIBUTIONS_TYPE_QUERY_KEY, DrawerTab} from './types';

const tabParser = parseAsStringLiteral(Object.values(DrawerTab)).withDefault(
  DrawerTab.TAGS
);

function setTabDisabled(_tab: DrawerTab) {
  return Promise.resolve(new URLSearchParams());
}

export function useDrawerTab({enabled}: {enabled: boolean}) {
  const [tab, setTab] = useQueryState(DISTRIBUTIONS_TYPE_QUERY_KEY, tabParser);

  return enabled ? {tab, setTab} : {tab: DrawerTab.TAGS, setTab: setTabDisabled};
}
