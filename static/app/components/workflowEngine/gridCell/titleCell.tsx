import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import useProjectFromId from 'sentry/utils/useProjectFromId';

export type TitleCellProps = {
  link: string;
  name: string;
  className?: string;
  createdBy?: string | null;
  details?: string[];
  disabled?: boolean;
  projectId?: string;
};

export function TitleCell({
  name,
  createdBy,
  projectId,
  details,
  link,
  disabled = false,
  className,
}: TitleCellProps) {
  const project = useProjectFromId({project_id: projectId});
  return (
    <TitleWrapper to={link} disabled={disabled} className={className}>
      <Name disabled={disabled}>
        <strong>{name}</strong>
        {!createdBy && (
          <IconSentry size="xs" color="subText" style={{alignSelf: 'center'}} />
        )}
        {disabled && <span>&mdash; Disabled</span>}
      </Name>
      {(defined(project) || (details && details.length > 0)) && (
        <DetailsWrapper>
          {project && (
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
          )}
          {details?.map((detail, index) => (
            <Fragment key={index}>
              <Separator />
              {detail}
            </Fragment>
          ))}
        </DetailsWrapper>
      )}
    </TitleWrapper>
  );
}

const Name = styled('div')<{disabled: boolean}>`
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};

  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.disabled};
    `}
`;

const TitleWrapper = styled(Link)<{disabled: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;

  ${p =>
    !p.disabled &&
    css`
      &:hover ${Name} {
        color: ${p.theme.textColor};
        text-decoration: underline;
      }
    `};
`;

const DetailsWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
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
