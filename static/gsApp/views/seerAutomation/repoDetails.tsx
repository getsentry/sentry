import {useEffect} from 'react';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

// Redirect route for backward compat: repos/:repoId/ → repos/?repoId=:repoId
export default function SeerRepoDetailsRedirect() {
  const {repoId} = useParams<{repoId: string}>();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();

  useEffect(() => {
    navigate(
      {
        pathname: normalizeUrl(`/settings/${organization.slug}/seer/repos/`),
        query: {...location.query, repoId},
      },
      {replace: true}
    );
    // Only redirect once on mount — repoId and org are stable for this route instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
