import {useMemo} from 'react';
import {parseAsArrayOf, parseAsString, useQueryState} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {useProjects} from 'sentry/utils/useProjects';

export function PickProject({
  children,
  multiple,
}:
  | {
      children: (projectSlug: string) => React.ReactNode;
      multiple: false;
    }
  | {
      children: (projectSlugs: string[]) => React.ReactNode;
      multiple: true;
    }) {
  const {projects} = useProjects();
  const [projectSlugs, setProjectSlugs] = useQueryState(
    'projects',
    parseAsArrayOf(parseAsString).withDefault([])
  );

  const projectOptions = useMemo(
    () => projects.map(p => ({value: p.slug, label: p.slug})),
    [projects]
  );

  if (multiple) {
    return (
      <Flex direction="column" gap="lg">
        <CompactSelect
          onChange={selected => setProjectSlugs(selected.map(opt => opt.value))}
          options={projectOptions}
          search
          size="xs"
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Projects" />
          )}
          value={projectSlugs ?? undefined}
          multiple
        />
        {projectSlugs ? (
          children(projectSlugs)
        ) : (
          <Flex justify="center" padding="xl">
            <Text variant="muted">Select a project to view the story</Text>
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <CompactSelect
        onChange={selected => setProjectSlugs([selected.value])}
        options={projectOptions}
        search
        size="xs"
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix="Project" />
        )}
        value={projectSlugs[0] ?? undefined}
      />
      {projectSlugs.length ? (
        children(projectSlugs.at(0) ?? '')
      ) : (
        <Flex justify="center" padding="xl">
          <Text variant="muted">Select a project to view the story</Text>
        </Flex>
      )}
    </Flex>
  );
}
