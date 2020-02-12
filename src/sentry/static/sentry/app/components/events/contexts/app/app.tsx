import React from 'react';

import ContextBlock from 'app/components/events/contexts/contextBlockV2';

import getAppKnownData, {AppData} from './getAppKnownData';

type Props = {
  data?: AppData;
};

const App = ({data}: Props) => {
  if (data === undefined || data === null) {
    return null;
  }

  return <ContextBlock knownData={getAppKnownData(data)} />;
};

App.getTitle = () => 'App';

export default App;
