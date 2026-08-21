import {useMemo} from 'react';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';

import type {OverviewRun} from './types';

const UNASSIGNED = 'unassigned';

function assigneeValue(assignedTo: Actor | null): string {
  return assignedTo ? `${assignedTo.type}:${assignedTo.id}` : UNASSIGNED;
}

export function matchesAssignee(run: OverviewRun, selected: string): boolean {
  return assigneeValue(run.issue.assignedTo) === selected;
}

export function AssigneeFilter({
  runs,
  value,
  onChange,
}: {
  onChange: (value: string | null) => void;
  runs: OverviewRun[];
  value: string | null;
}) {
  const options = useMemo(() => {
    const byValue = new Map<string, {actor: Actor | null; count: number}>();
    for (const run of runs) {
      const key = assigneeValue(run.issue.assignedTo);
      const entry = byValue.get(key) ?? {actor: run.issue.assignedTo, count: 0};
      entry.count += 1;
      byValue.set(key, entry);
    }

    const actorOptions = [...byValue.entries()]
      .filter((entry): entry is [string, {actor: Actor; count: number}] =>
        Boolean(entry[1].actor)
      )
      .map(([key, {actor, count}]) => ({
        value: key,
        label: actor.type === 'team' ? `#${actor.name}` : actor.name,
        leadingItems: <ActorAvatar actor={actor} size={18} />,
        trailingItems: <Badge variant="muted">{count}</Badge>,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const unassigned = byValue.get(UNASSIGNED);
    return unassigned
      ? [
          ...actorOptions,
          {
            value: UNASSIGNED,
            label: t('Unassigned'),
            trailingItems: <Badge variant="muted">{unassigned.count}</Badge>,
          },
        ]
      : actorOptions;
  }, [runs]);

  return (
    <CompactSelect
      clearable
      search
      options={options}
      value={value ?? undefined}
      onChange={selected => onChange(selected?.value ?? null)}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Assignee')} />
      )}
    />
  );
}
