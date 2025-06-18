import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type DetectorLinkProps = {
  createdBy: string | null;
  detectorId: string;
  disabled: boolean;
  name: string;
  projectId: string;
  className?: string;
};

export function DetectorLink({
  detectorId,
  name,
  createdBy,
  projectId,
  className,
  disabled,
}: DetectorLinkProps) {
  const org = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  return (
    <StyledLink
      to={makeMonitorDetailsPathname(org.slug, detectorId)}
      className={className}
    >
      <Name>
        <NameText>{name}</NameText>
        {!createdBy && <CreatedBySentryIcon size="xs" color="subText" />}
        {disabled && <span>&mdash; Disabled</span>}
      </Name>
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
      </DetailsWrapper>
    </StyledLink>
  );
}

const Name = styled('div')`
  color: ${p => p.theme.textColor};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const NameText = styled('span')`
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const CreatedBySentryIcon = styled(IconSentry)`
  flex-shrink: 0;
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${space(0.5)};
  flex: 1;
  overflow: hidden;

  &:hover {
    ${Name} {
      text-decoration: underline;
    }
  }
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
