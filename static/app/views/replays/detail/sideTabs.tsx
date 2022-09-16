import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

const TABS = {
  crumbs: t('Breadcrumbs'),
  tags: t('Tags'),
};

type Props = {
  className?: string;
};

function SideTabs({className}: Props) {
  const organization = useOrganization();
  const {getParamValue, setParamValue} = useUrlParams('t_side', 'crumbs');
  const active = getParamValue();

  const createTabChangeHandler = (tab: string) => () => {
    trackAdvancedAnalyticsEvent('replay.details-tab-changed', {
      tab,
      organization,
    });
    setParamValue(tab);
  };

  return (
    <NavTabs underlined className={className}>
      {Object.entries(TABS).map(([tab, label]) => {
        return (
          <li key={tab} className={active === tab ? 'active' : ''}>
            <a onClick={createTabChangeHandler(tab)}>{label}</a>
          </li>
        );
      })}
    </NavTabs>
  );
}

export default SideTabs;
