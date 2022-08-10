import {useCallback} from 'react';
import {browserHistory} from 'react-router';

import {generateProfilingRoute} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

import LegacyProfilingOnboarding from './legacyProfilingOnboarding';

export default function LegacyOnboarding() {
  const organization = useOrganization();

  const onDismissClick = useCallback(() => {
    browserHistory.push(generateProfilingRoute({orgSlug: organization.slug}));
  }, [organization.slug]);

  return (
    <LegacyProfilingOnboarding
      organization={organization}
      onDoneClick={onDismissClick}
      onDismissClick={onDismissClick}
    />
  );
}
