import {Button} from '@sentry/scraps/button';

import {IconLab} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function MockToggle() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOn = location.query.mock === '1';

  const handleToggle = () => {
    const nextQuery: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(location.query)) {
      if (k === 'mock') continue;
      if (typeof v === 'string' || Array.isArray(v)) nextQuery[k] = v;
    }
    if (!isOn) nextQuery.mock = '1';
    navigate({pathname: location.pathname, query: nextQuery}, {replace: true});
  };

  return (
    <Button
      size="sm"
      priority={isOn ? 'primary' : 'default'}
      icon={<IconLab />}
      onClick={handleToggle}
      aria-pressed={isOn}
    >
      {isOn ? t('Mocks: On') : t('Mocks: Off')}
    </Button>
  );
}
