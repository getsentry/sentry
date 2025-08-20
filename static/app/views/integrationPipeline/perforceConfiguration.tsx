import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import TextField from 'sentry/components/forms/fields/textField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

type PerforceConfiguration = {
  base_url: string;
  depot_name: string;
  password: string;
  username: string;
  verify_ssl: boolean;
};

type PerforceConfigurationProps = {
  organization: Organization;
  base_url?: string;
  depot_name?: string;
  error?: string;
  username?: string;
  verify_ssl?: boolean;
};

export function PerforceConfiguration({
  base_url = '',
  username = '',
  depot_name = 'main',
  verify_ssl = true,
  error,
}: PerforceConfigurationProps) {
  const [config, setConfig] = useState<PerforceConfiguration>({
    base_url,
    username,
    password: '',
    depot_name,
    verify_ssl,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.base_url || !config.username || !config.password) {
      addErrorMessage(t('All fields are required'));
      return;
    }

    addLoadingMessage(t('Connecting to Perforce server...'));
    setIsSaving(true);

    try {
      const form = new FormData();
      form.append('base_url', config.base_url);
      form.append('username', config.username);
      form.append('password', config.password);
      form.append('depot_name', config.depot_name);
      if (config.verify_ssl) {
        form.append('verify_ssl', 'on');
      }

      const currentParams = new URLSearchParams(window.location.search);
      const response = await fetch(window.location.href, {
        method: 'POST',
        body: form,
        headers: {
          'X-CSRFToken': currentParams.get('csrfmiddlewaretoken') || '',
        },
      });

      if (response.ok) {
        // If successful, the backend will redirect us to the next step
        window.location.reload();
      } else {
        const errorText = await response.text();
        addErrorMessage(t('Failed to connect to Perforce server: %s', errorText));
        setIsSaving(false);
      }
    } catch (err) {
      addErrorMessage(t('Failed to connect to Perforce server'));
      setIsSaving(false);
    }
  };

  const handleFieldChange = (
    field: keyof PerforceConfiguration,
    value: string | boolean
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Fragment>
      <StyledContainer>
        <Panel>
          <PanelHeader>
            <HeaderContent>
              <IconCode size="lg" />
              <HeaderText>
                <h3>{t('Configure Perforce Integration')}</h3>
                <p>
                  {t(
                    'Connect your Sentry organization with your Perforce server to enable stacktrace linking.'
                  )}
                </p>
              </HeaderText>
            </HeaderContent>
          </PanelHeader>
          <PanelBody>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <TextField
                  name="base_url"
                  label={t('Perforce Server URL')}
                  placeholder="https://perforce.example.com:1666"
                  value={config.base_url}
                  onChange={(value: string) => handleFieldChange('base_url', value)}
                  required
                  help={t('The URL of your Perforce Code Review server')}
                />
              </FieldGroup>

              <FieldGroup>
                <TextField
                  name="username"
                  label={t('Username')}
                  placeholder="your-perforce-username"
                  value={config.username}
                  onChange={(value: string) => handleFieldChange('username', value)}
                  required
                  help={t('Your Perforce username')}
                />
              </FieldGroup>

              <FieldGroup>
                <TextField
                  name="password"
                  label={t('Password')}
                  type="password"
                  placeholder="your-perforce-password"
                  value={config.password}
                  onChange={(value: string) => handleFieldChange('password', value)}
                  required
                  help={t('Your Perforce password or API token')}
                />
              </FieldGroup>

              <FieldGroup>
                <TextField
                  name="depot_name"
                  label={t('Depot Name')}
                  placeholder="main"
                  value={config.depot_name}
                  onChange={(value: string) => handleFieldChange('depot_name', value)}
                  help={t('The name of the primary depot to use')}
                />
              </FieldGroup>

              <FieldGroup>
                <BooleanField
                  name="verify_ssl"
                  label={t('Verify SSL Certificate')}
                  value={config.verify_ssl}
                  onChange={(value: boolean) => handleFieldChange('verify_ssl', value)}
                  help={t(
                    'Verify SSL certificates when connecting to the Perforce server'
                  )}
                />
              </FieldGroup>

              <ButtonContainer>
                <Button type="submit" priority="primary" disabled={isSaving}>
                  {isSaving ? t('Connecting...') : t('Connect')}
                </Button>
              </ButtonContainer>
            </form>
          </PanelBody>
        </Panel>
      </StyledContainer>
    </Fragment>
  );
}

const StyledContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(2)};
  max-width: 600px;
  margin: 0 auto;
  margin-top: 5%;
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${space(2)};
`;

const HeaderText = styled('div')`
  h3 {
    margin: 0 0 ${space(1)} 0;
  }
  p {
    margin: 0;
    color: ${p => p.theme.subText};
  }
`;

const FieldGroup = styled('div')`
  margin-bottom: ${space(3)};
`;

const ButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
`;

const ErrorMessage = styled('div')`
  background: ${p => p.theme.error};
  color: ${p => p.theme.errorText};
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
`;
