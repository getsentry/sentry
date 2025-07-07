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
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {useLocalStorageFlows} from './hooks/useLocalStorageFlows';
import type {Flow} from './types';

function FlowCreateForm({
  organization: _organization,
  onCreatedFlow,
  startBreadcrumb,
  endBreadcrumb,
  replaySlug,
  orgSlug,
}: {
  onCreatedFlow: (flow: Flow) => void;
  organization: Organization;
  endBreadcrumb?: string | null;
  orgSlug?: string;
  replaySlug?: string;
  startBreadcrumb?: string | null;
}) {
  const {createFlow} = useLocalStorageFlows();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = useCallback(async () => {
    const nameField = document.querySelector('input[name="name"]') as HTMLInputElement;
    const name = nameField?.value || '';

    if (!name.trim()) return;

    setIsSubmitting(true);
    addLoadingMessage();

    try {
      const newFlow = await createFlow({
        name: name.trim(),
        createdBy: 'Current User',
        status: 'Active',
        failures: 0,
        linkedIssues: [],
        // Store breadcrumb data as metadata
        metadata: {
          startBreadcrumb,
          endBreadcrumb,
          replaySlug,
          orgSlug,
        },
      });

      addSuccessMessage(t('Created flow successfully.'));
      onCreatedFlow(newFlow);

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
    startBreadcrumb,
    endBreadcrumb,
    replaySlug,
    orgSlug,
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
    (flow: Flow) => {
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
            organization={organization}
            onCreatedFlow={handleCreatedFlow}
            replaySlug={replaySlug}
            orgSlug={organization.slug}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
