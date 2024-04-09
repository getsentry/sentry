import styled from '@emotion/styled';
import queryString from 'query-string';

import ListLink from 'sentry/components/links/listLink';
import ScrollableTabs from 'sentry/components/replays/scrollableTabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useUrlParams from 'sentry/utils/useUrlParams';

type Props = {
  className?: string;
  underlined?: boolean;
};

const TABS = {
  details: t('Details'),
  request: t('Request'),
  response: t('Response'),
};

export type TabKey = keyof typeof TABS;

function NetworkDetailsTabs({className, underlined = true}: Props) {
  const {pathname, query} = useLocation();
  const {getParamValue, setParamValue} = useUrlParams('n_detail_tab', 'details');
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

const StyledNetworkDetailsTabs = styled(NetworkDetailsTabs)`
  /*
  Use padding instead of margin so all the <li> will cover the <SplitDivider>
  without taking 100% width.
  */

  & > li {
    margin-right: 0;
    padding-right: ${space(3)};
    background: ${p => p.theme.surface400};
    z-index: ${p => p.theme.zIndex.initial};
  }
  & > li:first-child {
    padding-left: ${space(2)};
  }
  & > li:last-child {
    padding-right: ${space(1)};
  }

  & > li > a {
    padding-top: ${space(1)};
    padding-bottom: ${space(0.5)};
    height: 100%;
    border-bottom: ${space(0.5)} solid transparent;
  }
`;

export default StyledNetworkDetailsTabs;
