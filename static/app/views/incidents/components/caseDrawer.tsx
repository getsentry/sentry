import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout';
import {Select} from 'sentry/components/core/select';
import {Heading, Text} from 'sentry/components/core/text';
import {TextArea} from 'sentry/components/core/textarea';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useCreateIncidentCase} from 'sentry/views/incidents/hooks/useCreateIncidentCase';
import type {IncidentCase, IncidentCaseTemplate} from 'sentry/views/incidents/types';

interface CaseDrawerProps {
  onClose: () => void;
  template: IncidentCaseTemplate;
  onSuccess?: (caseData: IncidentCase) => void;
}

const SEVERITY_COUNT = 5;

const STATUS_OPTIONS = [
  {label: t('Investigating'), value: 'investigating'},
  {label: t('Identified'), value: 'identified'},
  {label: t('Monitoring'), value: 'monitoring'},
  {label: t('Resolved'), value: 'resolved'},
];

export function CaseDrawer({template}: CaseDrawerProps) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const user = useUser();

  const [caseData, setCaseData] = useState<Partial<IncidentCase>>({
    title: '',
    description: '',
    severity: 4,
    status: 'investigating',
    // HACK: Need to dodge TS here to get to the API
    template: template.id as any,
    case_lead: '1' as any,
  });

  const createCase = useCreateIncidentCase({
    organizationSlug: organization.slug,
    onSuccess: (result: IncidentCase) => {
      navigate(`/organizations/${organization.slug}/issues/incidents/${result.id}/`);
    },
  });

  const handleSubmit = () => {
    createCase.createMutation.mutate(caseData);
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Fragment>
      <DrawerHeader>
        <Text size="lg" bold>
          {t('Declare an Incident')}
        </Text>
      </DrawerHeader>

      <CaseDrawerBody>
        <FormSection>
          <Heading as="h2">{t('What we need from you.')}</Heading>

          <Flex direction="column" justify="end" padding="xl 0" gap="xl">
            <Flex direction="column">
              <Text size="md" bold>
                Incident Title
              </Text>
              <Input
                name="title"
                placeholder={t('Enter incident title')}
                required
                value={caseData.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCaseData({...caseData, title: e.target.value})
                }
              />
            </Flex>

            <Flex direction="column">
              <Text size="md" bold>
                Description
              </Text>
              <TextArea
                name="description"
                placeholder={t('Describe what happened and any relevant details')}
                rows={4}
                value={caseData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCaseData({...caseData, description: e.target.value})
                }
              />
            </Flex>
            <Flex direction="row" gap="md">
              <Flex direction="column" flex={1}>
                <Text size="md" bold>
                  Severity
                </Text>
                <Select
                  name="severity"
                  label={t('Severity')}
                  options={Array.from({length: SEVERITY_COUNT}, (_, i) => ({
                    label: `${template.severity_handle}${i}`,
                    value: i + 1,
                  }))}
                  required
                  value={caseData.severity}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setCaseData({...caseData, severity: parseInt(e.target.value, 10)})
                  }
                />
              </Flex>
              <Flex direction="column" flex={1}>
                <Text size="md" bold>
                  Current Status
                </Text>
                <Select
                  name="status"
                  label={t('Status')}
                  options={STATUS_OPTIONS}
                  required
                  value={caseData.status}
                  onChange={(e: any) =>
                    setCaseData({...caseData, status: e.target.value})
                  }
                />
              </Flex>
            </Flex>
            <Flex direction="column" flex={1}>
              <Text size="md" bold>
                {template.case_lead_title}
              </Text>
              <Select
                name="caseLead"
                label={t('Case Lead')}
                value={1}
                options={[
                  {
                    label: user.name,
                    value: 1,
                    leadingItems: <UserAvatar user={user} style={{margin: 0}} />,
                  },
                ]}
                required
              />
            </Flex>
          </Flex>
        </FormSection>

        <FormSection>
          <Heading as="h2">{t('What we got covered.')}</Heading>
          <Flex direction="column" justify="end" padding="xl 0 0 0">
            <InfoRow>
              <InfoLabel>{t('The on-call will be paged...')}</InfoLabel>
              <Flex gap="md" align="center">
                <PluginIcon pluginId={template.schedule_provider!} />
                <Text>
                  {toTitleCase(template.schedule_provider!)} -{' '}
                  {template.schedule_config?.service?.label}
                </Text>
              </Flex>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t('A channel will be created in...')}</InfoLabel>
              <Flex gap="md" align="center">
                <PluginIcon pluginId={template.channel_provider!} />
                <Text>
                  {toTitleCase(template.channel_provider!)} - <Text>Hackweek 2025</Text>
                </Text>
              </Flex>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t('A task will be added to...')}</InfoLabel>
              <Flex gap="md" align="center">
                <PluginIcon pluginId={template.task_provider!} />
                <Text>
                  {toTitleCase(template.task_provider!)} -{' '}
                  {template.task_config?.project?.code}
                </Text>
              </Flex>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t('A retro doc will setup in...')}</InfoLabel>
              <Flex gap="md" align="center">
                <PluginIcon pluginId={template.retro_provider!} />
                <Text>
                  {toTitleCase(template.retro_provider!)} -{' '}
                  {template.retro_config?.database?.title?.plain_text}
                </Text>
              </Flex>
            </InfoRow>
            <InfoRow>
              <InfoLabel>{t('Smokey will be ready to update...')}</InfoLabel>
              <Flex gap="md" align="center">
                <PluginIcon pluginId={template.status_page_provider!} />
                <Text>{template.status_page_config?.statuspage?.url}</Text>
              </Flex>
            </InfoRow>
            <Flex justify="end" padding="xl md">
              <Button
                borderless
                priority="link"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                icon={<IconChevron direction={isExpanded ? 'up' : 'down'} />}
              >
                {isExpanded ? t('Hide Details') : t('Show More')}
              </Button>
            </Flex>
            {isExpanded && (
              <Fragment>
                {template.case_handle && (
                  <InfoRow>
                    <InfoLabel>{t('Case Handle')}</InfoLabel>
                    <InfoValue>{template.case_handle}</InfoValue>
                  </InfoRow>
                )}
                {template.severity_handle && (
                  <InfoRow>
                    <InfoLabel>{t('Severity Handle')}</InfoLabel>
                    <InfoValue>{template.severity_handle}</InfoValue>
                  </InfoRow>
                )}
                {template.case_lead_title && (
                  <InfoRow>
                    <InfoLabel>{t('Lead Title')}</InfoLabel>
                    <InfoValue>{template.case_lead_title}</InfoValue>
                  </InfoRow>
                )}
                {template.update_frequency_minutes && (
                  <InfoRow>
                    <InfoLabel>{t('Update Frequency')}</InfoLabel>
                    <InfoValue>
                      {t('Every %s minutes', template.update_frequency_minutes)}
                    </InfoValue>
                  </InfoRow>
                )}
              </Fragment>
            )}
          </Flex>
        </FormSection>
        <Flex justify="end">
          <Button
            type="submit"
            priority="danger"
            disabled={createCase.createMutation.isPending}
            onClick={handleSubmit}
          >
            {createCase.createMutation.isPending
              ? t('Creating...')
              : t('Declare Incident')}
          </Button>
        </Flex>
      </CaseDrawerBody>
    </Fragment>
  );
}

const CaseDrawerBody = styled(DrawerBody)`
  background: linear-gradient(
    to bottom right,
    ${p => p.theme.background} 0%,
    ${p => p.theme.backgroundSecondary} 80%,
    ${p => p.theme.backgroundTertiary} 100%
  );
  height: calc(100vh - 40px);
`;

const FormSection = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
`;

const InfoRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${p => p.theme.space.sm} 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};

  &:last-child {
    border-bottom: none;
  }
`;

const InfoLabel = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
`;

const InfoValue = styled('span')`
  color: ${p => p.theme.subText};
  text-align: right;
`;
