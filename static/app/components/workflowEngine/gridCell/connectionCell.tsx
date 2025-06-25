import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

export type ConnectionCellProps = {
  ids: string[];
  type: 'detector' | 'workflow';
  className?: string;
  disabled?: boolean;
};

const labels: Record<ConnectionCellProps['type'], (n: number) => string> = {
  detector: count => tn('%s monitor', '%s monitors', count),
  workflow: count => tn('%s automation', '%s automations', count),
};
const links: Record<
  ConnectionCellProps['type'],
  (orgSlug: string, id: string) => string
> = {
  detector: (orgSlug, id) => makeMonitorDetailsPathname(orgSlug, id),
  workflow: (orgSlug, id) => makeAutomationDetailsPathname(orgSlug, id),
};

export function ConnectionCell({
  ids: items = [],
  type,
  disabled = false,
  className,
}: ConnectionCellProps) {
  if (items.length === 0) {
    return <EmptyCell className={className} />;
  }
  const renderText = labels[type];
  return (
    <div className={className}>
      <StyledHovercard body={<Overlay ids={items} type={type} />} hide={disabled}>
        <MonitorCount>{renderText(items.length)}</MonitorCount>
      </StyledHovercard>
    </div>
  );
}

function Overlay(props: ConnectionCellProps) {
  const {ids, type} = props;
  const organization = useOrganization();

  const createLink = links[type];
  // TODO(natemoo-re): fetch data for each id
  return ids.map((id, index) => {
    const link = createLink(organization.slug, id);
    const description = 'description';
    return (
      <Fragment key={id}>
        {index > 0 && <Divider />}
        <HovercardRow to={link}>
          <strong>
            {type}-{index + 1}
          </strong>
          <MonitorDetails>
            <ProjectBadge
              css={css`
                && img {
                  box-shadow: none;
                }
              `}
              project={{id: '1', slug: 'project-slug'}}
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
    );
  });
}

const StyledHovercard = styled(Hovercard)<{hide?: boolean}>`
  ${p =>
    p.hide &&
    css`
      display: none;
    `};
`;

const MonitorDetails = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${space(0.75)};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
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
    border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
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
