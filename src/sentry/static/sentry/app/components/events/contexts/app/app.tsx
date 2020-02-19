import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';
import {defined} from 'app/utils';

import getAppKnownData from './getAppKnownData';
import {AppData} from './types';

type Props = {
  data?: AppData;
};

const App = ({data}: Props) => {
  if (!defined(data)) {
    return null;
  }

  return <ContextBlock knownData={getAppKnownData(data)} />;
};

App.getTitle = () => 'App';

export default App;
