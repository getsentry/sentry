import {Location} from 'history';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {t} from 'sentry/locale';
import Histogram from 'sentry/utils/performance/histogram';

import {ZOOM_END, ZOOM_START} from './utils';

type Props = {
  location: Location;
};

function ChartControls({location}: Props) {
  return (
    <Histogram location={location} zoomKeys={[ZOOM_START, ZOOM_END]}>
      {({filterOptions, handleFilterChange, activeFilter}) => {
        return (
          <OptionSelector
            title={t('Outliers')}
            selected={activeFilter.value}
            options={filterOptions}
            onChange={handleFilterChange}
          />
        );
      }}
    </Histogram>
  );
}

export default ChartControls;
