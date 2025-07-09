import styled from '@emotion/styled';

import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface ExportProfileButtonProps
  extends Omit<LinkButtonProps, 'title' | 'onClick' | 'children' | 'external'> {
  eventId: string | undefined;
  orgId: string;
  projectId: string | undefined;
  children?: React.ReactNode;
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

  return props.size === 'zero' ? (
    <DownloadButton href={href} download={download} {...props}>
      {props.children}
      <IconDownload size="xs" />
    </DownloadButton>
  ) : (
    <LinkButton
      icon={<IconDownload redesign redesign redesign redesign />}
      title={title}
      href={href}
      download={download}
      size="xs"
      {...props}
    >
      {props.children}
    </LinkButton>
  );
}

const DownloadButton = styled('a')`
  padding: ${space(0.5)} ${space(0.5)};
  color: ${p => p.theme.tokens.content.primary};

  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    color: ${p => p.theme.tokens.content.primary};
  }
`;
