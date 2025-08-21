import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useCreateIncidentCaseTemplate} from 'sentry/views/incidents/hooks/useCreateIncidentCaseTemplate';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';
import {ToolConnectCard} from 'sentry/views/incidents/wizard/toolConnectCard';

export function TemplateSummary({
  template,
  allowCreate = false,
}: {
  template: IncidentCaseTemplate;
  allowCreate?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {
    case_handle,
    case_lead_title,
    severity_handle,
    update_frequency_minutes,
    schedule_config,
    schedule_provider,
    task_config,
    task_provider,
    channel_config,
    channel_provider,
    status_page_config,
    retro_config,
    retro_provider,
    status_page_provider,
  } = template;

  const {data: integrations = [], isPending} = useApiQuery<OrganizationIntegration[]>(
    [`/organizations/${organization.slug}/integrations/`],
    {staleTime: 30000}
  );

  const createTemplate = useCreateIncidentCaseTemplate({
    organizationSlug: organization.slug,
    onSuccess: () => {
      navigate(location.pathname);
    },
  });

  const integrationsByProvider = useMemo(() => {
    return integrations?.reduce(
      (acc, integration) => {
        acc[integration.provider.key] = integration;
        return acc;
      },
      {} as Record<string, OrganizationIntegration>
    );
  }, [integrations]);

  return (
    <Flex
      direction="column"
      gap="lg"
      flex="1"
      maxWidth="415px"
      style={{opacity: isPending ? 0.5 : 1}}
    >
      <Flex direction="column" gap="xl">
        <Flex direction="column" gap="xs">
          <Flex justify="between" align="center">
            <Text bold>{t('Your Preferences')}</Text>
            {isPending && <LoadingIndicator size={16} style={{margin: 0}} />}
          </Flex>
          <Flex
            direction="column"
            gap="xs"
            border="primary"
            radius="md"
            padding="md"
            maxWidth="400px"
          >
            <Flex justify="between" align="center">
              <Text>{case_handle || t('Not set')}</Text>
              <Text bold>{t('Case Handle')}</Text>
            </Flex>
            <Flex justify="between" align="center">
              <Text>{case_lead_title || t('Not set')}</Text>
              <Text bold>{t('Lead Title')}</Text>
            </Flex>
            <Flex justify="between" align="center">
              <Text>{severity_handle || t('Not set')}</Text>
              <Text bold>{t('Severity Handle')}</Text>
            </Flex>
            <Flex justify="between" align="center">
              <Text>{update_frequency_minutes || t('Not set')}</Text>
              <Text bold>{t('Update Frequency')}</Text>
            </Flex>
          </Flex>
        </Flex>
        <Flex direction="column" gap="lg" align="start">
          <Flex direction="column" gap="xs">
            <Text bold>{t('You get paged via...')}</Text>
            <ToolCard
              config={schedule_config}
              integration={schedule_provider && integrationsByProvider[schedule_provider]}
            />
          </Flex>
          <Flex direction="column" gap="xs">
            <Text bold>{t('Add tasks/action-items with...')}</Text>
            <ToolCard
              config={task_config}
              integration={task_provider && integrationsByProvider[task_provider]}
            />
          </Flex>
          <Flex direction="column" gap="xs">
            <Text bold>{t('Focus discussions (with Smokey) in...')}</Text>
            <ToolCard
              config={channel_config}
              integration={channel_provider && integrationsByProvider[channel_provider]}
            />
          </Flex>
          <Flex direction="column" gap="xs">
            <Text bold>{t('Share with users via...')}</Text>
            <ToolCard
              config={status_page_config}
              integration={
                status_page_provider && integrationsByProvider[status_page_provider]
              }
            />
          </Flex>
          <Flex direction="column" gap="xs">
            <Text bold>{t('Gather post-mortems in...')}</Text>
            <ToolCard
              config={retro_config}
              integration={retro_provider && integrationsByProvider[retro_provider]}
            />
          </Flex>
        </Flex>
        {allowCreate && (
          <Button
            priority="primary"
            onClick={() => createTemplate.createMutation.mutate(template)}
            style={{marginTop: '12px'}}
          >
            {t('Finalize Setup')}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}

const ToolCard = styled(ToolConnectCard)`
  border-color: ${p => p.theme.border};
`;
