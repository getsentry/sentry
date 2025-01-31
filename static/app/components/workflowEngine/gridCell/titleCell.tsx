import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

export type TitleCellProps = {
  link: string;
  name: string;
  project: AvatarProject;
  details?: string[];
  disabled?: boolean;
};

export function TitleCell({
  name,
  project,
  details,
  link,
  disabled = false,
}: TitleCellProps) {
  return (
    <div>
      <TitleWrapper to={link} disabled={disabled}>
        <Name disabled={disabled}>
          <strong>{name}</strong>
          {disabled && <span>&mdash; Disabled</span>}
        </Name>
        <DetailsWrapper>
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
          {details?.map((detail, index) => (
            <Fragment key={index}>
              <Separator />
              {detail}
            </Fragment>
          ))}
        </DetailsWrapper>
      </TitleWrapper>
    </div>
  );
}

const Name = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};

  ${p =>
    p.disabled &&
    `
    color: ${p.theme.disabled};
  `}
`;

const TitleWrapper = styled(Link)<{disabled: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};

  ${p =>
    !p.disabled &&
    `
    &:hover ${Name} {
      color: ${p.theme.textColor};
      text-decoration: underline;
    }
  `}
`;

const DetailsWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
  min-width: 500px;
  white-space: nowrap;
  line-height: 1.2;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    line-height: 1;
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  color: ${p => p.theme.subText};
`;

const Separator = styled('span')`
  height: 10px;
  width: 1px;
  background-color: ${p => p.theme.innerBorder};
  border-radius: 1px;
`;
