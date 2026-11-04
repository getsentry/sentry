import {Outlet} from 'react-router';

import {NotFound} from 'sentry/components/errors/notFound';
import {useClassifiersEnabled} from 'sentry/views/classifiers/utils';

export default function ClassifiersLayout() {
  const classifiersEnabled = useClassifiersEnabled();

  if (!classifiersEnabled) {
    return <NotFound />;
  }

  return <Outlet />;
}
