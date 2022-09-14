import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/useUrlParams';

const TABS = {
  crumbs: t('Breadcrumbs'),
  tags: t('Tags'),
};

type Props = {
  className?: string;
};

function SideTabs({className}: Props) {
  const {getParamValue, setParamValue} = useUrlParams('t_side', 'crumbs');
  const active = getParamValue();

  return (
    <NavTabs underlined className={className}>
      {Object.entries(TABS).map(([tab, label]) => {
        return (
          <li key={tab} className={active === tab ? 'active' : ''}>
            <a onClick={() => setParamValue(tab)}>{label}</a>
          </li>
        );
      })}
    </NavTabs>
  );
}

export default SideTabs;
