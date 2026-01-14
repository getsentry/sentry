import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface ShortIdBreadcrumbProps {
  group: Group;
  organization: Organization;
  project: Project;
}

export function ShortIdBreadcrumb({
  organization,
  project,
  group,
}: ShortIdBreadcrumbProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const {copy} = useCopyToClipboard();

  const handleCopyShortId = useCallback(() => {
    copy(group.shortId, {successMessage: t('Copied Short-ID to clipboard')}).then(() => {
      trackAnalytics('issue_details.copy_issue_short_id_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        streamline: hasStreamlinedUI,
      });
    });
  }, [copy, organization, group, hasStreamlinedUI]);

  const issueUrl =
    window.location.origin +
    normalizeUrl(`/organizations/${organization.slug}/issues/${group.id}/`);

  const handleCopyUrl = useCallback(() => {
    copy(issueUrl, {successMessage: t('Copied Issue URL to clipboard')}).then(() => {
      trackAnalytics('issue_details.copy_issue_url_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        streamline: hasStreamlinedUI,
      });
    });
  }, [copy, organization, group, hasStreamlinedUI, issueUrl]);

  const handleCopyMarkdown = useCallback(() => {
    copy(`[${group.shortId}](${issueUrl})`, {
      successMessage: t('Copied Markdown Issue Link to clipboard'),
    }).then(() => {
      trackAnalytics('issue_details.copy_issue_markdown_link_clicked', {
        organization,
        ...getAnalyticsDataForGroup(group),
        streamline: hasStreamlinedUI,
      });
    });
  }, [copy, organization, group, hasStreamlinedUI, issueUrl]);

  if (!group.shortId) {
    return null;
  }

  return (
    <Flex align="center" gap="md">
      <ProjectBadge
        project={project}
        avatarSize={16}
        hideName
        avatarProps={{hasTooltip: true, tooltip: project.slug}}
      />
      <ShortIdCopyable>
        <Tooltip
          title={t(
            'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
          )}
          position="bottom"
          delay={1000}
        >
          <StyledShortId shortId={group.shortId} />
        </Tooltip>
        <DropdownMenu
          triggerProps={{
            'aria-label': t('Issue copy actions'),
            icon: <IconChevron direction="down" size="sm" />,
            size: 'zero',
            borderless: true,
            showChevron: false,
          }}
          position="bottom"
          size="xs"
          items={[
            {
              key: 'copy-url',
              label: t('Copy Issue URL'),
              onAction: handleCopyUrl,
            },
            {
              key: 'copy-short-id',
              label: t('Copy Short-ID'),
              onAction: handleCopyShortId,
            },
            {
              key: 'copy-markdown-link',
              label: t('Copy Markdown Link'),
              onAction: handleCopyMarkdown,
            },
          ]}
        />
      </ShortIdCopyable>
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
  gap: ${space(0.25)};
  align-items: center;

  button[aria-haspopup] {
    display: block;
    opacity: 0;
    transition: opacity 50ms linear;
  }

  &:hover button[aria-haspopup],
  button[aria-expanded='true'],
  button[aria-haspopup]:focus-visible {
    opacity: 1;
  }
`;
