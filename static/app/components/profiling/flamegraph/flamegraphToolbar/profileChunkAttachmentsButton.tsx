import {skipToken, useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';

import {useRole} from 'sentry/components/acl/useRole';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

// Content type Relay tags Perfetto system traces with when forwarding them as
// profile-chunk attachments. Used to give the download a more specific label.
const PERFETTO_TRACE_CONTENT_TYPE = 'application/x-perfetto-trace';

interface ProfileChunkAttachment {
  chunkId: string;
  contentType: string | null;
  dateAdded: string;
  id: string;
  name: string;
  profilerId: string;
}

function getDownloadUrl(
  organization: Organization,
  project: Project,
  attachment: ProfileChunkAttachment
): string {
  return `/api/0/projects/${organization.slug}/${project.slug}/profiling/chunks/${attachment.profilerId}/${attachment.chunkId}/attachments/${attachment.id}/?download=1`;
}

/**
 * Lists the attachments (e.g. Perfetto traces) for the profiler currently in
 * view and lets the user download them. Renders nothing unless there is at
 * least one attachment: a single button when there is exactly one, and a
 * dropdown when several are available across the visible chunks.
 *
 * Listing is unscoped, but downloading requires the org's attachments role
 * (enforced by the download endpoint), so the controls are disabled with a
 * tooltip when the viewer lacks it.
 */
export function ProfileChunkAttachmentsButton() {
  const location = useLocation();
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const {hasRole: hasAttachmentRole} = useRole({role: 'attachmentsRole'});

  const profilerId =
    typeof location.query.profilerId === 'string' ? location.query.profilerId : null;
  const start = typeof location.query.start === 'string' ? location.query.start : null;
  const end = typeof location.query.end === 'string' ? location.query.end : null;

  const enabled = Boolean(project && profilerId && start && end);

  const {data: attachments} = useQuery(
    apiOptions.as<ProfileChunkAttachment[]>()(
      '/organizations/$organizationIdOrSlug/profiling/chunk-attachments/',
      {
        path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          project: project?.id,
          profiler_id: profilerId,
          // Match the exact window the flamegraph resolved its chunks from.
          start: start ? new Date(start).toISOString() : undefined,
          end: end ? new Date(end).toISOString() : undefined,
        },
        staleTime: 30_000,
      }
    )
  );

  if (!project || !attachments || attachments.length === 0) {
    return null;
  }

  const noPermissionTitle = t('Insufficient permissions to download attachments');

  if (attachments.length === 1) {
    const attachment = attachments[0]!;
    const label =
      attachment.contentType === PERFETTO_TRACE_CONTENT_TYPE
        ? t('Download Perfetto Trace')
        : t('Download Attachment');
    return (
      <LinkButton
        size="xs"
        icon={<IconDownload />}
        href={hasAttachmentRole ? getDownloadUrl(organization, project, attachment) : ''}
        disabled={!hasAttachmentRole}
        tooltipProps={{title: hasAttachmentRole ? undefined : noPermissionTitle}}
      >
        {label}
      </LinkButton>
    );
  }

  return (
    <DropdownMenu
      size="xs"
      triggerLabel={t('Download Attachments')}
      triggerProps={{
        icon: <IconDownload />,
        ...(hasAttachmentRole ? {} : {tooltipProps: {title: noPermissionTitle}}),
      }}
      isDisabled={!hasAttachmentRole}
      position="bottom-end"
      items={attachments.map(attachment => ({
        key: attachment.id,
        label: attachment.name,
        externalHref: getDownloadUrl(organization, project, attachment),
      }))}
    />
  );
}
