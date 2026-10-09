import {Fragment, useMemo} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {RawReplayError} from 'sentry/utils/replays/types';
import {useProjects} from 'sentry/utils/useProjects';

interface Props {
  replayErrors: RawReplayError[];
}

/**
 * How a replay's errors split across the projects that reported them.
 */
export function ReplayErrorsTooltip({replayErrors}: Props) {
  const {projects} = useProjects();

  const countsPerProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const error of replayErrors) {
      const projectSlug = error['project.name'];
      counts.set(projectSlug, (counts.get(projectSlug) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([, a], [, b]) => b - a);
  }, [replayErrors]);

  return (
    <Fragment>
      <Tooltip.Header>{t('Errors')}</Tooltip.Header>
      <Tooltip.Grid columns="max-content 1fr max-content">
        {countsPerProject.map(([projectSlug, count]) => (
          <Tooltip.Row
            key={projectSlug}
            leadingItems={
              <ProjectAvatar
                size={16}
                project={
                  projects.find(p => p.slug === projectSlug) ?? {slug: projectSlug}
                }
              />
            }
            trailingItems={<Text tabular>{count}</Text>}
          >
            <Text>{projectSlug}</Text>
          </Tooltip.Row>
        ))}
      </Tooltip.Grid>
    </Fragment>
  );
}
