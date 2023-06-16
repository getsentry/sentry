import {Fragment} from 'react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconFire} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';

type Props = {
  countErrors: number;
  className?: string;
  hideIcon?: boolean;
  project?: Project;
};

const ErrorCount = styled(({countErrors, project, className, hideIcon}: Props) =>
  countErrors ? (
    <span className={className}>
      {!hideIcon && (
        <Fragment>
          {project ? (
            <ProjectBadge project={project} disableLink hideName />
          ) : (
            <IconFire />
          )}
        </Fragment>
      )}
      {countErrors}
    </span>
  ) : (
    <span className={className}>0</span>
  )
)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => (p.countErrors > 0 ? p.theme.red400 : 'inherit')};
  font-variant-numeric: tabular-nums;
`;

export default ErrorCount;
