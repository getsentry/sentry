import {Fragment, useCallback, useMemo, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {
  OrganizationIntegration,
  ServerlessFunction,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

interface IntegrationServerlessRowProps {
  integration: OrganizationIntegration;
  onUpdate: (serverlessFunctionUpdate: Partial<ServerlessFunction>) => void;
  serverlessFunction: ServerlessFunction;
}

export function IntegrationServerlessRow({
  integration,
  onUpdate,
  serverlessFunction,
}: IntegrationServerlessRowProps) {
  const api = useApi();
  const organization = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const endpoint = `/organizations/${organization.slug}/integrations/${integration.id}/serverless-functions/`;

  const {version} = serverlessFunction;
  // during optimistic update, we might be enabled without a version
  const versionText =
    serverlessFunction.enabled && version > 0 ? (
      <Fragment>&nbsp;|&nbsp;v{version}</Fragment>
    ) : null;

  const recordAction = useCallback(
    (action: 'enable' | 'disable' | 'updateVersion') => {
      trackAnalytics('integrations.serverless_function_action', {
        integration: integration.provider.key,
        integration_type: 'first_party',
        action,
        organization,
      });
    },
    [integration.provider.key, organization]
  );

  const handleUpdate = useCallback(async () => {
    const data = {
      action: 'updateVersion',
      target: serverlessFunction.name,
    };
    try {
      setIsSubmitting(true);
      // don't know the latest version but at least optimistically remove the update button
      onUpdate({outOfDate: false});
      addLoadingMessage();
      recordAction('updateVersion');
      const resp = await api.requestPromise(endpoint, {
        method: 'POST',
        data,
      });
      // update remaining after response
      onUpdate(resp);
      addSuccessMessage(t('Success'));
    } catch (err: any) {
      // restore original on failure
      onUpdate(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    setIsSubmitting(false);
  }, [api, endpoint, onUpdate, recordAction, serverlessFunction]);

  const handleToggle = async () => {
    const action = serverlessFunction.enabled ? 'disable' : 'enable';
    const data = {
      action,
      target: serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      setIsSubmitting(true);
      // optimistically update enable state
      onUpdate({enabled: !serverlessFunction.enabled});
      recordAction(action);
      const resp = await api.requestPromise(endpoint, {
        method: 'POST',
        data,
      });
      // update remaining after response
      onUpdate(resp);
      addSuccessMessage(t('Success'));
    } catch (err: any) {
      // restore original on failure
      onUpdate(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    setIsSubmitting(false);
  };

  const layerStatus = useMemo(() => {
    if (!serverlessFunction.outOfDate) {
      return serverlessFunction.enabled ? t('Latest') : t('Disabled');
    }
    return (
      <Button size="sm" variant="primary" onClick={handleUpdate}>
        {t('Update')}
      </Button>
    );
  }, [serverlessFunction.outOfDate, serverlessFunction.enabled, handleUpdate]);

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell direction="column" align="start" gap="md">
        <Text wordBreak="break-word">{serverlessFunction.name}</Text>
        <Text variant="muted">
          {serverlessFunction.runtime}
          {versionText}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>{layerStatus}</SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Switch
          aria-label={t('Enable %s', serverlessFunction.name)}
          checked={serverlessFunction.enabled}
          disabled={isSubmitting}
          onChange={handleToggle}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
