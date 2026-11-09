import {useMemo} from 'react';
import {useQueryState} from 'nuqs';

import {Tooltip} from '@sentry/scraps/tooltip';

import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {getTooltipText} from './utils';
import {ValueElement} from './valueElement';

type Props = {
  meta: Record<any, any>;
  value: React.ReactNode;
};

export function FilteredAnnotatedTextValue({value, meta}: Props) {
  const organization = useOrganization();
  const [projectIds] = useQueryState('project', pageFilterParsers.project);
  const {projects} = useProjects();
  const currentProject =
    projectIds.length === 1
      ? projects.find(project => project.id === projectIds[0])
      : undefined;

  // Fetch full project details including `project.relayPiiConfig`
  // That property is not normally available in the store
  const {data: projectDetails} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: currentProject?.slug ?? ''},
    {
      retry: false,
      enabled: !!currentProject?.slug,
      notifyOnChangeProps: ['data'],
    }
  );

  const tooltipText = useMemo(() => {
    return getTooltipText({
      rule_id: meta.rem[0][0],
      remark: meta.rem[0][1],
      organization,
      project: projectDetails,
    });
  }, [meta.rem, organization, projectDetails]);

  return (
    <Tooltip title={tooltipText}>
      <ValueElement value={value} meta={meta} />
    </Tooltip>
  );
}
