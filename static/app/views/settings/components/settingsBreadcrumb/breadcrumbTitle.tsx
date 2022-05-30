import {useEffect} from 'react';
import {PlainRoute} from 'react-router';

import SettingsBreadcrumbStore from 'sentry/stores/settingsBreadcrumbStore';

type Props = {
  routes: Array<PlainRoute>;
  title: string;
};

function BreadcrumbTitle(props: Props) {
  useEffect(
    () => SettingsBreadcrumbStore.updateRouteMap(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return null;
}

export default BreadcrumbTitle;
