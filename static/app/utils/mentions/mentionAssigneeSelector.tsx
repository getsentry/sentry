import type {ComposerMentionActions, MentionData} from '@sentry/scraps/composer';
import {Text} from '@sentry/scraps/text';

import type {
  AssignableEntity,
  AssigneeGroup,
} from 'sentry/components/assigneeSelectorDropdown';
import {AssigneeSelector} from 'sentry/components/group/assigneeSelector';
import type {Actor} from 'sentry/types/core';
import type {User} from 'sentry/types/user';

interface MentionAssigneeSelectorTriggers {
  team: string | null;
  user: string;
}

interface MentionAssigneeSelectorProps {
  actions: ComposerMentionActions;
  mention: MentionData;
  /** The project whose members and teams the menu offers. */
  project: AssigneeGroup['project'];
  triggers: MentionAssigneeSelectorTriggers;
}

export function getUserMentionLabel(user: User): string {
  return user.name || user.email || user.username || user.id;
}

function getMentionedActor(
  mention: MentionData,
  triggers: MentionAssigneeSelectorTriggers
): Actor | null {
  const [type, id] = mention.id.split(':');
  if ((type !== 'user' && type !== 'team') || !id) {
    return null;
  }

  const trigger = type === 'team' ? triggers.team : triggers.user;
  const name =
    trigger && mention.text.startsWith(trigger)
      ? mention.text.slice(trigger.length)
      : mention.text;
  return {id, name, type};
}

function getReplacementMention(
  entity: AssignableEntity,
  triggers: MentionAssigneeSelectorTriggers
): MentionData | null {
  if (entity.type === 'user') {
    const label =
      'username' in entity.assignee
        ? getUserMentionLabel(entity.assignee)
        : entity.assignee.name;
    return {
      id: `user:${entity.id}`,
      sourceId: 'members',
      text: `${triggers.user}${label}`,
    };
  }

  if (triggers.team === null) {
    return null;
  }
  return {
    id: `team:${entity.id}`,
    sourceId: 'teams',
    text: `${triggers.team}${entity.assignee.name}`,
  };
}

/**
 * Renders a member or team mention as the issue stream's assignee selector.
 * Picking someone else swaps the mention and clearing removes it; the issue's
 * assignee never changes.
 */
export function MentionAssigneeSelector({
  actions,
  mention,
  project,
  triggers,
}: MentionAssigneeSelectorProps) {
  const group: AssigneeGroup = {
    id: mention.id,
    assignedTo: getMentionedActor(mention, triggers),
    owners: null,
    project,
  };

  // The editor's text and mention styles would otherwise cascade into the menu.
  return (
    <Text
      as="span"
      display="inline-block"
      variant="primary"
      bold={false}
      wrap="normal"
      wordBreak="normal"
      cursor="default"
    >
      <AssigneeSelector
        assigneeLoading={false}
        group={group}
        showLabel
        useOwnerAssignmentDetails={false}
        handleAssigneeChange={entity => {
          if (!entity) {
            actions.remove();
            return;
          }
          const replacement = getReplacementMention(entity, triggers);
          if (replacement) {
            actions.replace(replacement);
          }
        }}
      />
    </Text>
  );
}
