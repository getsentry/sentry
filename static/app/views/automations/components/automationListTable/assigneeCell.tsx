import {ActorAvatar} from '@sentry/scraps/avatar';

import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import type {Actor} from 'sentry/types/core';

/**
 * `automation.owner` is an actor identifier string like `user:1` or `team:1`
 *
 * Parse this string to be then passed into `Actor Avatar`, which will resolve the name and avatar itself
 */

type ParsedOwner = {id: string; type: Actor['type']} | null;

export function parseAutomationOwner(owner: string | null): ParsedOwner {
  if (!owner) {
    return null;
  }

  const [type, id] = owner.split(':');

  if (!type || !id) {
    return null;
  }

  if (type !== 'user' && type !== 'team') {
    return null;
  }

  return {type, id};
}

type AssigneeCellProps = {
  owner: string | null;
};

export function AssigneeCell({owner}: AssigneeCellProps) {
  const actor = parseAutomationOwner(owner);

  if (!actor) {
    return <EmptyCell />;
  }

  return <ActorAvatar actor={actor} size={24} />;
}
