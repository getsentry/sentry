import {useEffect} from 'react';

import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface WorkflowEngineFeatureGateOptions {
  /**
   * If true, this hook will programatically redirect users to the homepage
   * @default false
   */
  redirect?: boolean;
}
export function useWorkflowEngineFeatureGate({
  redirect = false,
}: WorkflowEngineFeatureGateOptions) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const hasFeature = organization.features.includes('workflow-engine-ui');

  useEffect(() => {
    if (!redirect) {
      return;
    }
    if (hasFeature) {
      return;
    }
    navigate('/');
  }, [navigate, hasFeature, redirect]);

  return hasFeature;
}
