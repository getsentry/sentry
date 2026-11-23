import {Outlet} from 'react-router';

import {NotFound} from 'sentry/components/errors/notFound';

import {useClassifiersEnabled} from './utils';

export default function ClassifiersLayout() {
  const classifiersEnabled = useClassifiersEnabled();

  if (!classifiersEnabled) {
    return <NotFound />;
  }

  return <Outlet />;
}
