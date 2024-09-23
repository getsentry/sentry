import styled from '@emotion/styled';

import type {LinkButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface ExportProfileButtonProps
  extends Omit<LinkButtonProps, 'onClick' | 'children' | 'external'> {
  eventId: string | undefined;
  orgId: string;
  projectId: string | undefined;
  children?: React.ReactNode;
  variant?: 'xs' | 'default';
}

export function ExportProfileButton(props: ExportProfileButtonProps) {
  const api = useApi();
  const organization = useOrganization();

  const project = useProjects().projects.find(p => {
    return p.slug === props.projectId;
  });

  const href = `${api.baseUrl}/projects/${props.orgId}/${props.projectId}/profiling/raw_profiles/${props.eventId}/`;
  const download = `${organization.slug}_${
    project?.slug ?? props.projectId ?? 'unknown_project'
  }_${props.eventId}.profile.json`;

  const title = t('Export Profile');

  return props.variant === 'xs' ? (
    <StyledButtonSmall size="xs" title={title} href={href} download={download} {...props}>
      {props.children}
      <IconDownload size="xs" />
    </StyledButtonSmall>
  ) : (
    <LinkButton
      icon={<IconDownload />}
      title={title}
      href={href}
      download={download}
      {...props}
    >
      {props.children}
    </LinkButton>
  );
}

const StyledButtonSmall = styled(LinkButton)`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: 0.5;
  padding: ${space(0.5)} ${space(0.5)};

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
  }
`;
