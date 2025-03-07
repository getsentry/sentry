import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  OrganizationIntegration,
  ServerlessFunction,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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
    } catch (err) {
      // restore original on failure
      onUpdate(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    setIsSubmitting(false);
  }, [api, endpoint, onUpdate, recordAction, serverlessFunction]);

  const handleToggle = useCallback(async () => {
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
    } catch (err) {
      // restore original on failure
      onUpdate(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    setIsSubmitting(false);
  }, [api, endpoint, onUpdate, recordAction, serverlessFunction]);

  const layerStatus = useMemo(() => {
    if (!serverlessFunction.outOfDate) {
      return serverlessFunction.enabled ? t('Latest') : t('Disabled');
    }
    return (
      <UpdateButton size="sm" priority="primary" onClick={handleUpdate}>
        {t('Update')}
      </UpdateButton>
    );
  }, [serverlessFunction.outOfDate, serverlessFunction.enabled, handleUpdate]);

  return (
    <Item>
      <NameWrapper>
        <NameRuntimeVersionWrapper>
          <Name>{serverlessFunction.name}</Name>
          <RuntimeAndVersion>
            <DetailWrapper>{serverlessFunction.runtime}</DetailWrapper>
            <DetailWrapper>{versionText}</DetailWrapper>
          </RuntimeAndVersion>
        </NameRuntimeVersionWrapper>
      </NameWrapper>
      <LayerStatusWrapper>{layerStatus}</LayerStatusWrapper>
      <StyledSwitch
        checked={serverlessFunction.enabled}
        disabled={isSubmitting}
        size="sm"
        onChange={handleToggle}
      />
    </Item>
  );
}

const Item = styled('div')`
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2fr 1fr 0.5fr;
  grid-template-areas: 'function-name layer-status enable-switch';
`;

const ItemWrapper = styled('span')`
  height: 32px;
  vertical-align: middle;
  display: flex;
  align-items: center;
`;

const NameWrapper = styled(ItemWrapper)`
  grid-area: function-name;
`;

const LayerStatusWrapper = styled(ItemWrapper)`
  grid-area: layer-status;
`;

const StyledSwitch = styled(Switch)`
  grid-area: enable-switch;
`;

const UpdateButton = styled(Button)``;

const NameRuntimeVersionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Name = styled(`span`)`
  padding-bottom: ${space(1)};
`;

const RuntimeAndVersion = styled('div')`
  display: flex;
  flex-direction: row;
  color: ${p => p.theme.gray300};
`;

const DetailWrapper = styled('div')`
  line-height: 1.2;
`;
