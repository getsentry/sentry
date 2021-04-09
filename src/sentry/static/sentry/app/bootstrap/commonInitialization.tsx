import 'focus-visible';

import {NODE_ENV} from 'app/constants';
import ConfigStore from 'app/stores/configStore';
import {setupColorScheme} from 'app/utils/matchMedia';

if (NODE_ENV === 'development') {
  import(
    /* webpackChunkName: "SilenceReactUnsafeWarnings" */ /* webpackMode: "eager" */ 'app/utils/silence-react-unsafe-warnings'
  );
}

// App setup
if (window.__initialData) {
  ConfigStore.loadInitialData(window.__initialData);
}

// setup darkmode + favicon
setupColorScheme();
