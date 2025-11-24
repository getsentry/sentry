import {useCallback, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useDrawer from 'sentry/components/globalDrawer';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAutomationCreatePathname} from 'sentry/views/automations/pathnames';
import {ConnectAutomationsDrawer} from 'sentry/views/detectors/components/connectAutomationsDrawer';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';

type Props = {
  detector: Detector;
};

export function DetectorDetailsAutomations({detector}: Props) {
  const organization = useOrganization();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const {mutate: updateDetector} = useUpdateDetector();
  const canEditWorkflowConnections = useCanEditDetectorWorkflowConnections({
    projectId: detector.projectId,
  });

  const setWorkflowIds = useCallback(
    (newWorkflowIds: string[]) => {
      addLoadingMessage();
      updateDetector(
        {
          detectorId: detector.id,
          workflowIds: newWorkflowIds,
        },
        {
          onSuccess: () => {
            addSuccessMessage(t('Connected alerts updated'));
          },
        }
      );
    },
    [detector.id, updateDetector]
  );

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectAutomationsDrawer
          initialWorkflowIds={detector.workflowIds}
          setWorkflowIds={setWorkflowIds}
        />
      ),
      {ariaLabel: t('Connect Alerts')}
    );
  };

  const permissionTooltipText = canEditWorkflowConnections
    ? undefined
    : t(
        'Ask your organization owner or manager to [settingsLink:enable alerts access] for you.',
        {
          settingsLink: (
            <Link
              to={{
                pathname: `/settings/${organization.slug}/`,
                hash: 'alertsMemberWrite',
              }}
            />
          ),
        }
      );

  return (
    <Section
      title={t('Connected Alerts')}
      trailingItems={
        <Button
          size="xs"
          onClick={toggleDrawer}
          disabled={!canEditWorkflowConnections}
          title={permissionTooltipText}
        >
          {t('Edit Connected Alerts')}
        </Button>
      }
    >
      <ErrorBoundary mini>
        <ConnectedAutomationsList
          automationIds={detector.workflowIds}
          cursor={cursor}
          onCursor={setCursor}
          emptyMessage={
            <Stack gap="xl" align="center">
              <Stack gap="sm" align="center">
                <Text as="p" align="center" variant="muted">
                  {t('No alerts are connected to this monitor.')}
                </Text>
                <Text as="p" align="center" variant="muted">
                  {t('You will not be notified when this monitor triggers.')}
                </Text>
              </Stack>
              <Stack gap="sm" align="center">
                <Button
                  size="xs"
                  onClick={toggleDrawer}
                  disabled={!canEditWorkflowConnections}
                  title={permissionTooltipText}
                >
                  {t('Connect Existing Alerts')}
                </Button>
                <LinkButton
                  href={makeAutomationCreatePathname(organization.slug, {
                    connectedIds: [detector.id],
                  })}
                  external
                  size="xs"
                  icon={<IconAdd />}
                  disabled={!canEditWorkflowConnections}
                  title={permissionTooltipText}
                >
                  {t('Create a New Alert')}
                </LinkButton>
              </Stack>
            </Stack>
          }
        />
      </ErrorBoundary>
    </Section>
  );
}
