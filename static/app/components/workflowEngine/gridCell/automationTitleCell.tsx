import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

export type AutomationTitleCellProps = {
  id: string;
  name: string;
  project: AvatarProject;
};

export function AutomationTitleCell({id, name, project}: AutomationTitleCellProps) {
  return (
    <div>
      <TitleWrapper to={`/automations/${id}/`}>
        <Name>{name}</Name>
        <StyledProjectBadge
          css={css`
            && img {
              box-shadow: none;
            }
          `}
          project={project}
          avatarSize={16}
          disableLink
        />
      </TitleWrapper>
    </div>
  );
}

const StyledProjectBadge = styled(ProjectBadge)`
  color: ${p => p.theme.subText};
`;

const Name = styled('strong')`
  color: ${p => p.theme.textColor};
`;

const TitleWrapper = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};

  &:hover ${Name} {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
  }
`;
