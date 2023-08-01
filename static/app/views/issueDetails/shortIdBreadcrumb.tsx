import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface ShortIdBreadrcumbProps {
  group: Group;
  organization: Organization;
  project: Project;
}

export function ShortIdBreadrcumb({
  organization,
  project,
  group,
}: ShortIdBreadrcumbProps) {
  const {onClick: handleCopyShortId} = useCopyToClipboard({
    text: group.shortId,
    successMessage: t('Copied Short-ID to clipboard'),
  });

  const issueUrl =
    window.location.origin +
    normalizeUrl(`/organizations/${organization.slug}/issues/${group.id}/`);

  const {onClick: handleCopyUrl} = useCopyToClipboard({
    text: issueUrl,
    successMessage: t('Copied Issue URL to clipboard'),
  });

  const {onClick: handleCopyMarkdown} = useCopyToClipboard({
    text: `[${group.shortId}](${issueUrl})`,
    successMessage: t('Copied Markdown Issue Link to clipboard'),
  });

  if (!group.shortId) {
    return null;
  }

  return (
    <GuideAnchor target="issue_number" position="bottom">
      <Wrapper>
        <ProjectBadge
          project={project}
          avatarSize={16}
          hideName
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
        />
        <ShortIdCopyable>
          <Tooltip
            className="help-link"
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
              'aria-label': t('Short-ID copy actions'),
              icon: <IconChevron direction="down" size="xs" />,
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
      </Wrapper>
    </GuideAnchor>
  );
}

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
  gap: ${space(0.25)};
  align-items: center;

  button[aria-haspopup] {
    display: block;
    opacity: 0;
    transition: opacity 50ms linear;
  }

  &:hover button[aria-haspopup],
  button[aria-expanded='true'],
  button[aria-haspopup].focus-visible {
    opacity: 1;
  }
`;
