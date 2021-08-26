import 'focus-visible';

import {NODE_ENV} from 'app/constants';
import ConfigStore from 'app/stores/configStore';
import {Config} from 'app/types';
import {setupColorScheme} from 'app/utils/matchMedia';

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'app/utils/silence-react-unsafe-warnings');
  }

  ConfigStore.loadInitialData(config);

  // setup darkmode + favicon
  setupColorScheme();
}
