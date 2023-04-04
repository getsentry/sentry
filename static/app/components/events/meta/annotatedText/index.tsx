import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {AnnotatedTextErrors} from './annotatedTextErrors';
import {AnnotatedTextValue} from './annotatedTextValue';

type Props = {
  value: React.ReactNode;
  className?: string;
  meta?: Record<any, any>;
};

export const AnnotatedText = ({value, meta, className, ...props}: Props) => {
  const organization = useOrganization();
  const location = useLocation();
  const projectId = location.query.project;
  const {projects} = useProjects();
  const currentProject = projects.find(project => project.id === projectId);

  return (
    <span className={className} {...props}>
      <AnnotatedTextValue
        value={value}
        meta={meta}
        project={currentProject}
        organization={organization}
      />
      <AnnotatedTextErrors errors={meta?.err} />
    </span>
  );
};
