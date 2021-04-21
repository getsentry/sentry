import {t} from 'app/locale';

import {DisplayType} from './types';

export const displayTypes = {
  [DisplayType.AREA]: t('Area Chart'),
  [DisplayType.BAR]: t('Bar Chart'),
  [DisplayType.LINE]: t('Line Chart'),
  [DisplayType.TABLE]: t('Table'),
  [DisplayType.WORLD_MAP]: t('World Map'),
  [DisplayType.BIG_NUMBER]: t('Big Number'),
};
