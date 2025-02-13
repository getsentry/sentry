import {useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import ShortId from 'sentry/components/shortId';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGlobe} from 'sentry/icons';
import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {getShareUrl} from 'sentry/views/issueDetails/actions/shareModal';
import StreamlinedShareIssueModal from 'sentry/views/issueDetails/actions/streamlinedShareModal';

interface ShortIdBreadcrumbProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export function IssueIdBreadcrumb({project, group, event}: ShortIdBreadcrumbProps) {
  const organization = useOrganization();
  const [isHovered, setIsHovered] = useState(false);
  const shareUrl = group?.shareId ? getShareUrl(group) : null;
  const {onClick: handleCopyShortId} = useCopyToClipboard({
    text: group.shortId,
    successMessage: t('Copied Short-ID to clipboard'),
    onCopy: () => {
      trackAnalytics('issue_details.copy_issue_short_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        streamline: true,
      });
    },
  });

  if (!group.shortId) {
    return null;
  }

  return (
    <BreadcrumbContainer>
      <Wrapper>
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
              icon={<IconCopy size="xs" color="subText" />}
            />
          )}
        </ShortIdCopyable>
      </Wrapper>
      {!isHovered && group.isPublic && shareUrl && (
        <Button
          size="zero"
          borderless
          aria-label={t('View issue share settings')}
          title={tct('This issue has been shared [link:with a public link].', {
            link: <ExternalLink href={shareUrl} />,
          })}
          tooltipProps={{isHoverable: true}}
          icon={
            <IconGlobe
              size="xs"
              color="subText"
              onClick={() =>
                openModal(modalProps => (
                  <StreamlinedShareIssueModal
                    {...modalProps}
                    organization={organization}
                    projectSlug={group.project.slug}
                    groupId={group.id}
                    onToggle={() =>
                      trackAnalytics('issue.shared_publicly', {
                        organization,
                      })
                    }
                    event={event}
                  />
                ))
              }
            />
          }
        />
      )}
    </BreadcrumbContainer>
  );
}

const BreadcrumbContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

const ShortIdCopyable = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  button[aria-haspopup] {
    display: block;
    opacity: 0;
    transition: opacity 50ms linear;
  }
`;
