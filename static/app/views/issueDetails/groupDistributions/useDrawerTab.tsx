import useUrlParams from 'sentry/utils/useUrlParams';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';

export default function useDrawerTab({enabled}: {enabled: boolean}) {
  const {getParamValue: getTabParam, setParamValue: setTabParam} = useUrlParams(
    'tab',
    DrawerTab.TAGS
  );

  return enabled
    ? {
        tab: getTabParam() as DrawerTab,
        setTab: setTabParam,
      }
    : {tab: DrawerTab.TAGS, setTab: (_tab: string) => {}};
}
