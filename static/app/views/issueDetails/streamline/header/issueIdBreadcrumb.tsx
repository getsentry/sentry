import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Tooltip} from '@sentry/scraps/tooltip';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {ShortId} from 'sentry/components/shortId';
import {IconCopy, IconGlobe} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getShareUrl, ShareIssueModal} from 'sentry/views/issueDetails/actions/shareModal';

interface ShortIdBreadcrumbProps {
  group: Group;
  project: Project;
}

export function IssueIdBreadcrumb({project, group}: ShortIdBreadcrumbProps) {
  const {openModal} = useModal();

  const organization = useOrganization();
  const shareUrl = group?.shareId ? getShareUrl(organization, group) : null;
  const {copy} = useCopyToClipboard();

  const handleCopyShortId = useCallback(() => {
    copy(group.shortId, {successMessage: t('Copied Short-ID to clipboard')}).then(() => {
      trackAnalytics('issue_details.copy_issue_short_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        streamline: true,
      });
    });
  }, [copy, organization, group]);

  if (!group.shortId) {
    return null;
  }

  return (
    <Flex align="center" gap="xs">
      <RevealOnHover gap="md">
        <ProjectBadge
          project={project}
          avatarSize={16}
          hideName
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
        <Tooltip
          title={t(
            'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
          )}
          position="bottom"
          delay={1000}
        >
          <StyledShortId onClick={handleCopyShortId} shortId={group.shortId} />
        </Tooltip>
        <RevealOnHover.Action>
          <Button
            tooltipProps={{title: t('Copy Issue Short-ID')}}
            aria-label={t('Copy Issue Short-ID')}
            onClick={handleCopyShortId}
            size="zero"
            variant="transparent"
            icon={<IconCopy size="xs" variant="muted" />}
          />
        </RevealOnHover.Action>
      </RevealOnHover>
      {group.isPublic && shareUrl && (
        <Button
          size="zero"
          variant="transparent"
          aria-label={t('View issue share settings')}
          icon={<IconGlobe size="xs" variant="muted" />}
          tooltipProps={{
            isHoverable: true,
            title: tct('This issue has been shared [link:with a public link].', {
              link: <ExternalLink href={shareUrl} />,
            }),
          }}
          onClick={() =>
            openModal(modalProps => (
              <ShareIssueModal
                {...modalProps}
                organization={organization}
                projectSlug={group.project.slug}
                groupId={group.id}
                onToggle={() =>
                  trackAnalytics('issue.shared_publicly', {
                    organization,
                  })
                }
                event={null}
                hasIssueShare
              />
            ))
          }
        />
      )}
    </Flex>
  );
}

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1;
`;
