import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  CaseSeverityLabel,
  CaseStatusLabel,
} from 'sentry/views/incidents/components/caseLabels';
import {LinkCard} from 'sentry/views/incidents/components/linkCard';
import type {IncidentCase} from 'sentry/views/incidents/types';
import {getIncidentLabel} from 'sentry/views/incidents/util';

export function CaseRow({incidentCase}: {incidentCase: IncidentCase}) {
  const organization = useOrganization();
  const user = useUser();

  return (
    <LinkCard
      to={`/organizations/${organization.slug}/issues/incidents/${incidentCase.id}/`}
    >
      <Flex justify="between" align="center">
        <Flex gap="lg">
          <Text bold>{getIncidentLabel(incidentCase)}</Text>
          <Text bold>{incidentCase.title}</Text>
        </Flex>
        <UserAvatar user={user} size={20} hasTooltip />
      </Flex>
      <Text>{ellipsize(incidentCase.description ?? '', 100)}</Text>
      <Flex justify="between" align="center">
        <Flex gap="md" align="center">
          <CaseSeverityLabel incidentCase={incidentCase} />
          <CaseStatusLabel incidentCase={incidentCase} />
        </Flex>
        <Flex gap="md" align="center">
          <LinkButton
            href={`slack://`}
            size="xs"
            icon={<PluginIcon pluginId={incidentCase.template.channel_provider as any} />}
          />
          <LinkButton
            to={'slack://'}
            size="xs"
            icon={<PluginIcon pluginId={incidentCase.template.task_provider as any} />}
          />
          <LinkButton
            to={'slack://'}
            size="xs"
            icon={<PluginIcon pluginId={incidentCase.template.retro_provider as any} />}
          />
        </Flex>
      </Flex>
    </LinkCard>
  );
}
