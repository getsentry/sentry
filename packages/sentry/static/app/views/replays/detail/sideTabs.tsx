import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';

type Props = {};

const TABS = {
  video: t('Replay'),
  tags: t('Tags'),
};

function SideTabs({}: Props) {
  const {getParamValue, setParamValue} = useUrlParams('t_side', 'video');
  const active = getParamValue();

  return (
    <NavTabs underlined>
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
