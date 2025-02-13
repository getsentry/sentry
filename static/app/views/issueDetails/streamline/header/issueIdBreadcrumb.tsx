import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface ShortIdBreadcrumbProps {
  group: Group;
  project: Project;
}

export function IssueIdBreadcrumb({project, group}: ShortIdBreadcrumbProps) {
  const {onClick: handleCopyShortId} = useCopyToClipboard({
    text: group.shortId,
    successMessage: t('Copied Short-ID to clipboard'),
  });

  if (!group.shortId) {
    return null;
  }

  return (
    <Wrapper>
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
        <Button
          aria-label={t('Copy Issue Short-ID')}
          onClick={handleCopyShortId}
          size="zero"
          borderless
          icon={<IconCopy size="xs" color="subText" />}
        />
      </ShortIdCopyable>
    </Wrapper>
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
  button[aria-haspopup]:focus-visible {
    opacity: 1;
  }
`;
