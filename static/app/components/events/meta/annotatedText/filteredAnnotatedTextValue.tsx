import {useMemo} from 'react';

import {Tooltip} from 'sentry/components/tooltip';
import type {Project} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {getTooltipText} from './utils';
import {ValueElement} from './valueElement';

type Props = {
  meta: Record<any, any>;
  value: React.ReactNode;
};

export function FilteredAnnotatedTextValue({value, meta}: Props) {
  const organization = useOrganization();
  const location = useLocation<{project: string}>();
  const projectId = location.query.project;
  const {projects} = useProjects();
  const currentProject = projects.find(project => project.id === projectId);

  // Fetch full project details including `project.relayPiiConfig`
  // That property is not normally available in the store
  const {data: projectDetails} = useApiQuery<Project>(
    [`/projects/${organization.slug}/${currentProject?.slug}/`],
    {
      staleTime: Infinity,
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
    <Tooltip title={tooltipText} isHoverable>
      <ValueElement value={value} meta={meta} />
    </Tooltip>
  );
}
