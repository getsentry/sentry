import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout/flex';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import type {IncidentCase} from 'sentry/views/incidents/types';
import {getIncidentLabel, getIncidentSeverity} from 'sentry/views/incidents/util';

export function CaseRow({incidentCase}: {incidentCase: IncidentCase}) {
  const organization = useOrganization();
  const user = useUser();

  return (
    <Card to={`/organizations/${organization.slug}/issues/incidents/${incidentCase.id}`}>
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
          <Flex padding="xs sm" border="primary" radius="2xl">
            <Text size="sm" variant="muted">
              {incidentCase.status}
            </Text>
          </Flex>
          <Flex padding="xs sm" border="primary" radius="2xl">
            <Text size="sm" variant="muted">
              {getIncidentSeverity(incidentCase)}
            </Text>
          </Flex>
          <Flex padding="xs sm" border="primary" radius="2xl">
            <Text size="sm" variant="muted">
              {incidentCase.status}
            </Text>
          </Flex>
        </Flex>
        <Flex gap="md" align="center">
          <LinkButton
            to={'slack://'}
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
    </Card>
  );
}

const Card = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.md};
  transition: transform 0.1s ease-in-out;
  z-index: 1;
  background: ${p => p.theme.tokens.background.primary};
  &:hover {
    transform: translateY(-2px);
    &:before {
      transform: translateY(2px);
    }
  }
  &:before {
    content: '';
    position: absolute;
    height: 100%;
    top: 4px;
    left: -1px;
    right: -1px;
    border-radius: ${p => p.theme.borderRadius};
    z-index: -1;
    background: ${p => p.theme.tokens.border.primary};
    transition: transform 0.1s ease-in-out;
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    background: ${p => p.theme.tokens.background.primary};
  }
`;
