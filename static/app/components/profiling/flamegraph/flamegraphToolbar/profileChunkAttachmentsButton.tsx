import {skipToken, useQuery} from '@tanstack/react-query';

import {useRole} from 'sentry/components/acl/useRole';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

// Content type Relay tags Perfetto system traces with when forwarding them as
// profile-chunk attachments. Used to give the download a more specific label.
// https://github.com/getsentry/relay/blob/d4526eabd7f5579ecfc6aa53ce5227d6fd493136/relay-server/src/envelope/content_type.rs#L65
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
 * view and lets the user download them via a dropdown. Renders nothing unless
 * there is at least one attachment across the visible chunks.
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

  const profilerId = decodeScalar(location.query.profilerId);
  const start = decodeScalar(location.query.start);
  const end = decodeScalar(location.query.end);

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

  return (
    <DropdownMenu
      size="xs"
      triggerLabel={t('Download')}
      triggerProps={{
        icon: <IconDownload />,
        ...(hasAttachmentRole
          ? {}
          : {
              tooltipProps: {
                title: t(
                  'Insufficient permissions. Ask your org admin to download attachments on your behalf or grant you the required permission.'
                ),
              },
            }),
      }}
      isDisabled={!hasAttachmentRole}
      position="bottom-end"
      items={attachments.map(attachment => ({
        key: attachment.id,
        label:
          attachment.contentType === PERFETTO_TRACE_CONTENT_TYPE
            ? t('Perfetto Trace')
            : t('Attachment'),
        details: `${attachment.chunkId} / ${attachment.name}`,
        externalHref: getDownloadUrl(organization, project, attachment),
      }))}
    />
  );
}
