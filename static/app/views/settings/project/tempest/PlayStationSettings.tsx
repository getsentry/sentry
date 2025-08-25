import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex} from 'sentry/components/core/layout';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeBoolean} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {AddCredentialsButton} from 'sentry/views/settings/project/tempest/addCredentialsButton';
import {ConfigForm} from 'sentry/views/settings/project/tempest/configForm';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';
import {MessageType} from 'sentry/views/settings/project/tempest/types';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

import {CredentialRow} from './CredentialRow';
import EmptyState from './EmptyState';

interface Props {
  organization: Organization;
  project: Project;
}

export default function PlayStationSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: tempestCredentials,
    isLoading,
    invalidateCredentialsCache,
  } = useFetchTempestCredentials(organization, project);

  const credentialErrors = useMemo(() => {
    return tempestCredentials?.filter(
      credential => credential.messageType === MessageType.ERROR && credential.message
    );
  }, [tempestCredentials]);

  useEffect(() => {
    if (credentialErrors && credentialErrors.length > 0) {
      trackAnalytics('tempest.credentials.error_displayed', {
        organization,
        project_slug: project.slug,
        error_count: credentialErrors.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialErrors]);

  const isSetupInstructionsOpen = decodeBoolean(location.query.setupInstructions);
  const hasCredentials = (tempestCredentials ?? []).length > 0;
  const showEmptyState = isSetupInstructionsOpen || !hasCredentials;

  return (
    <Fragment>
      {credentialErrors && credentialErrors?.length > 0 && (
        <Alert.Container>
          <Alert type="error">
            {t('There was a problem with following credentials:')}
            <List symbol="bullet">
              {credentialErrors.map(credential => (
                <ListItem key={credential.id}>
                  {credential.clientId} - {credential.message}
                </ListItem>
              ))}
            </List>
          </Alert>
        </Alert.Container>
      )}

      <ConfigForm organization={organization} project={project} />

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <Flex direction="column" gap="md" align="end">
          <ButtonBar>
            {hasCredentials && (
              <Button
                size="sm"
                onClick={() => {
                  navigate({
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      setupInstructions: !isSetupInstructionsOpen,
                    },
                  });
                }}
              >
                {isSetupInstructionsOpen
                  ? t('Close Setup Instructions')
                  : t('Open Setup Instructions')}
              </Button>
            )}
            <AddCredentialsButton project={project} />
          </ButtonBar>
          {showEmptyState ? (
            <Panel>
              <EmptyState
                project={project}
                isLoading={isLoading}
                hasWriteAccess={hasWriteAccess}
                tempestCredentials={tempestCredentials}
                onRemoveCredentialSuccess={invalidateCredentialsCache}
              />
            </Panel>
          ) : (
            <StyledPanelTable
              headers={[
                t('Client ID'),
                t('Status'),
                t('Created At'),
                t('Created By'),
                '',
              ]}
              isLoading={isLoading}
            >
              {tempestCredentials?.map(credential => (
                <CredentialRow
                  key={credential.id}
                  credential={credential}
                  hasWriteAccess={hasWriteAccess}
                  onRemoveCredentialSuccess={invalidateCredentialsCache}
                  project={project}
                />
              ))}
            </StyledPanelTable>
          )}
        </Flex>
      )}
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  width: 100%;
`;
