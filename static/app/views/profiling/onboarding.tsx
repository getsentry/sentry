import {useCallback} from 'react';
import {browserHistory} from 'react-router';

import {generateProfilingRoute} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

import ProfilingOnboarding from './profilingOnboarding';

export default function Onboarding() {
  const organization = useOrganization();

  const onDismissClick = useCallback(() => {
    browserHistory.push(generateProfilingRoute({orgSlug: organization.slug}));
  }, [organization.slug]);

  return (
    <ProfilingOnboarding
      organization={organization}
      onDoneClick={onDismissClick}
      onDismissClick={onDismissClick}
    />
  );
}
