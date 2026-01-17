import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {IconCopy, IconGlobe} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import ShareIssueModal, {getShareUrl} from 'sentry/views/issueDetails/actions/shareModal';

interface ShortIdBreadcrumbProps {
  group: Group;
  project: Project;
}

export function IssueIdBreadcrumb({project, group}: ShortIdBreadcrumbProps) {
  const organization = useOrganization();
  const [isHovered, setIsHovered] = useState(false);
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
      <Flex gap="md" align="center">
        <ProjectBadge
          project={project}
          avatarSize={16}
          hideName
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
        <ShortIdCopyable
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Tooltip
            title={t(
              'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
            )}
            position="bottom"
            delay={1000}
          >
            <StyledShortId onClick={handleCopyShortId} shortId={group.shortId} />
          </Tooltip>
          {isHovered && (
            <Button
              title={t('Copy Issue Short-ID')}
              aria-label={t('Copy Issue Short-ID')}
              onClick={handleCopyShortId}
              size="zero"
              borderless
              icon={<IconCopy size="xs" variant="muted" />}
            />
          )}
        </ShortIdCopyable>
      </Flex>
      {!isHovered && group.isPublic && shareUrl && (
        <Button
          size="zero"
          borderless
          aria-label={t('View issue share settings')}
          icon={<IconGlobe size="xs" variant="muted" />}
          title={tct('This issue has been shared [link:with a public link].', {
            link: <ExternalLink href={shareUrl} />,
          })}
          tooltipProps={{isHoverable: true}}
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
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1;
`;

const ShortIdCopyable = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  /* hardcoded height avoids layout shift on button hover */
  height: 36px;
  button[aria-haspopup] {
    display: block;
    opacity: 0;
    transition: opacity 50ms linear;
  }
`;
