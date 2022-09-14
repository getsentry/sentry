import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/useUrlParams';

const TABS = {
  crumbs: t('Breadcrumbs'),
  tags: t('Tags'),
};
type TabKey = keyof typeof TABS;

type Props = {
  tags: TabKey[];
  className?: string;
};

function SideTabs({tags, className}: Props) {
  const {getParamValue, setParamValue} = useUrlParams('t_side', 'crumbs');
  const active = getParamValue();

  return (
    <NavTabs underlined className={className}>
      {Object.entries(TABS)
        .filter(([tab]) => tags.includes(tab as TabKey))
        .map(([tab, label]) => {
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
