import {useCallback, useEffect, useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useUser} from 'sentry/utils/useUser';
import {useCreateFlowTemp} from 'sentry/views/codecov/flows/hooks';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

function FlowCreateForm({
  onCreatedFlow,
  startBreadcrumb,
  endBreadcrumb,
  replaySlug,
}: {
  onCreatedFlow: (flow: FlowDefinition) => void;
  endBreadcrumb?: string | null;
  orgSlug?: string;
  replaySlug?: string;
  startBreadcrumb?: string | null;
}) {
  const {selection} = usePageFilters();
  const {mutateAsync: createFlow, isPending: isCreating} = useCreateFlowTemp({
    pageFilters: selection,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const user = useUser();

  const handleSubmit = useCallback(async () => {
    const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
    const name = nameField?.value || '';

    if (!name.trim()) return;

    setIsSubmitting(true);
    addLoadingMessage();

    try {
      const response = await createFlow({
        name: name.trim(),
        createdBy: {
          email: user.email,
          id: user.id,
          name: user.name,
          avatar: user.avatarUrl,
        },
        status: 'active',
        description: `Flow created from replay: ${replaySlug || 'manual'}`,
        replayId: replaySlug,
        startBreadcrumb: startBreadcrumb || undefined,
        endBreadcrumb: endBreadcrumb || undefined,
      });

      addSuccessMessage(t('Created flow successfully.'));
      onCreatedFlow(response.data);

      // Navigate back to the flows list
      navigate('/codecov/flows/');
    } catch (error) {
      const message = t('Failed to create a new flow.');
      addErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    createFlow,
    user.email,
    user.id,
    user.name,
    user.avatarUrl,
    replaySlug,
    startBreadcrumb,
    endBreadcrumb,
    onCreatedFlow,
    navigate,
  ]);

  const isFormValid = () => {
    const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
    const name = nameField?.value || '';
    return name.trim() && startBreadcrumb && endBreadcrumb;
  };

  const getTooltipMessage = () => {
    const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
    const name = nameField?.value || '';

    if (!name.trim()) {
      return t('Please enter a flow name');
    }
    if (!startBreadcrumb) {
      return t('Please select a start point');
    }
    if (!endBreadcrumb) {
      return t('Please select an end point');
    }
    return '';
  };

  return (
    <div style={{display: 'flex', gap: '8px'}}>
      <Tooltip title={getTooltipMessage()} disabled={!!isFormValid()}>
        <Button
          priority="primary"
          disabled={isSubmitting || !isFormValid()}
          onClick={handleSubmit}
        >
          {t('Create Flow')}
        </Button>
      </Tooltip>
      <Button priority="default" onClick={() => navigate(`/codecov/flows/`)}>
        {t('Cancel')}
      </Button>
    </div>
  );
}

export {FlowCreateForm};
export default function FlowCreatePage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const [replaySlug, setReplaySlug] = useState<string | undefined>();

  // Extract replay slug from URL query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const replay = searchParams.get('replay');
    if (replay) {
      setReplaySlug(replay);
    }
  }, [location.search]);

  const _handleGoBack = useCallback(() => navigate(`/codecov/flows/`), [navigate]);

  const handleCreatedFlow = useCallback(
    (flow: FlowDefinition) => {
      navigate(`/codecov/flows/${flow.id}`);
    },
    [navigate]
  );

  return (
    <div>
      <Panel>
        <PanelHeader>
          {replaySlug ? t('Create New Flow from Replay') : t('Create New Flow')}
        </PanelHeader>

        <PanelBody>
          <FlowCreateForm
            onCreatedFlow={handleCreatedFlow}
            replaySlug={replaySlug}
            orgSlug={organization.slug}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
