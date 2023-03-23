import {ReactText} from 'react';
import queryString from 'query-string';

import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useUrlParams from 'sentry/utils/useUrlParams';

type Props = {
  className?: string;
  underlined?: boolean;
};

const TABS: Record<string, ReactText> = {
  headers: t('Headers'),
  request: t('Request'),
  response: t('Response'),
};

export type TabKey = keyof typeof TABS;

function NetworkRequestTabs({className, underlined = true}: Props) {
  const {pathname, query} = useLocation();
  const {getParamValue, setParamValue} = useUrlParams('n_details_tab', 'headers');
  const activeTab = getParamValue();

  return (
    <ScrollableTabs className={className} underlined={underlined}>
      {Object.entries(TABS).map(([tab, label]) => (
        <ListLink
          key={tab}
          isActive={() => tab === activeTab}
          to={`${pathname}?${queryString.stringify({...query, t_main: tab})}`}
          onClick={e => {
            e.preventDefault();
            setParamValue(tab);
          }}
        >
          {label}
        </ListLink>
      ))}
    </ScrollableTabs>
  );
}

export default NetworkRequestTabs;
