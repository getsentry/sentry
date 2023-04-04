import queryString from 'query-string';

import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useUrlParams from 'sentry/utils/useUrlParams';

const TABS = {
  crumbs: t('Breadcrumbs'),
  tags: t('Tags'),
};

type Props = {
  className?: string;
};

const SideTabs = ({className}: Props) => {
  const {pathname, query} = useLocation();
  const {getParamValue, setParamValue} = useUrlParams('t_side', 'crumbs');
  const activeTab = getParamValue();

  return (
    <ScrollableTabs className={className} underlined>
      {Object.entries(TABS).map(([tab, label]) => (
        <ListLink
          key={tab}
          isActive={() => tab === activeTab}
          to={`${pathname}?${queryString.stringify({...query, t_side: tab})}`}
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
};

export default SideTabs;
