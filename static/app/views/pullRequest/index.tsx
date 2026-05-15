import {Outlet} from 'react-router-dom';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function PullRequestContainer() {
  const organization = useOrganization();

  return (
    <NoProjectMessage organization={organization}>
      <UrlParamBatchProvider>
        <Outlet />
      </UrlParamBatchProvider>
    </NoProjectMessage>
  );
}
