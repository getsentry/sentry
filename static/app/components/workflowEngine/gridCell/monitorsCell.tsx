import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

export type Monitor = {
  id: string;
  name: string;
  project: AvatarProject;
  description?: string;
};

type MonitorsCellProps = {
  monitors: Monitor[];
};

export function MonitorsCell({monitors}: MonitorsCellProps) {
  if (monitors.length === 0) {
    return <EmptyCell />;
  }
  return (
    <div>
      <Hovercard
        body={monitors.map(({name, id, project, description}, index) => (
          <Fragment key={id}>
            {index > 0 && <Divider />}
            <HovercardRow to={`/monitors/${id}/`}>
              <strong>{name}</strong>
              <MonitorDetails>
                <ProjectBadge
                  css={css`
                    && img {
                      box-shadow: none;
                    }
                  `}
                  project={project}
                  avatarSize={16}
                  disableLink
                />
                {description && (
                  <Fragment>
                    <Separator />
                    {description}
                  </Fragment>
                )}
              </MonitorDetails>
            </HovercardRow>
          </Fragment>
        ))}
      >
        <MonitorCount>{tn('%s monitor', '%s monitors', monitors.length)}</MonitorCount>
      </Hovercard>
    </div>
  );
}

const MonitorDetails = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  min-width: 500px;
  white-space: nowrap;
  line-height: 1.2;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    line-height: 1;
  }
`;

const Separator = styled('span')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
  border-radius: 1px;
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
`;

const HovercardRow = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.textColor};
  margin: -${space(2)};
  padding: ${space(2)};

  &:first-child {
    border-radius: ${p => p.theme.borderRadiusTop};
  }

  &:last-child {
    border-radius: ${p => p.theme.borderRadiusBottom};
  }

  &:hover {
    background-color: ${p => p.theme.backgroundTertiary};
    color: ${p => p.theme.textColor};
  }

  &:hover strong {
    text-decoration: underline;
  }
`;

const MonitorCount = styled('span')`
  text-decoration: underline solid ${p => p.theme.border};
  text-underline-offset: ${space(0.25)};
`;
