import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {useFetchEventAttachments} from 'sentry/actionCreators/events';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {
  getContextIcon,
  getContextSummary,
  getContextTitle,
} from 'sentry/components/events/contexts/utils';
import ScreenshotModal, {
  modalCss,
} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import {SCREENSHOT_NAMES} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/utils';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconAttachment, IconReleases, IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import useOrganization from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

interface HighlightsIconSummaryProps {
  event: Event;
  group?: Group;
}

export function HighlightsIconSummary({event, group}: HighlightsIconSummaryProps) {
  const theme = useTheme();
  const organization = useOrganization();

  // Project slug and project id are pull out because group is not always available
  const projectSlug = group?.project.slug ?? event.projectSlug;
  const projectId = group?.project.id ?? event.projectID;
  const projectPlatform = group?.project.platform;

  const {data: attachments = []} = useFetchEventAttachments({
    orgSlug: organization.slug,
    projectSlug,
    eventId: event.id,
  });
  const screenshot = attachments.find(({name}) => SCREENSHOT_NAMES.includes(name));
  // Hide device for non-native platforms since it's mostly duplicate of the client_os or os context
  const shouldDisplayDevice =
    isMobilePlatform(projectPlatform) || isNativePlatform(projectPlatform);

  // Errors thrown on the backend of a Meta-Framework (e.g. Next.js) also include the client context
  const isMetaFrameworkBackendIssue =
    Object.keys(event.contexts).includes('client_os') &&
    Object.keys(event.contexts).includes('os');

  // For now, highlight icons are only interpreted from context. We should extend this to tags
  // eventually, but for now, it'll match the previous expectations.
  const items = getOrderedContextItems(event)
    .map(item => ({
      ...getContextSummary(item),
      contextTitle: getContextTitle(item),
      contextType: item.type,
      alias: item.alias,
      icon: getContextIcon({
        alias: item.alias,
        type: item.type,
        value: item.value,
        contextIconProps: {
          size: 'md',
        },
        theme,
      }),
    }))
    .filter((item, _index, array) => {
      if (
        // Hide client information in backend issues (always prefer `os` over `client_os`)
        isMetaFrameworkBackendIssue &&
        (item.contextType === 'browser' || item.alias === 'client_os')
      ) {
        return false;
      }

      // Prefer the runtime to browser if they're both the same
      if (item.contextType === 'browser') {
        // If the runtime is the same as the browser, prefer the runtime
        const runtime = array.find(i => i.contextType === 'runtime');
        if (runtime?.title === item.title) {
          return false;
        }
      }

      const hasData = item.icon !== null && Boolean(item.title || item.subtitle);
      if (item.alias === 'device') {
        return hasData && shouldDisplayDevice;
      }

      return hasData;
    });

  const releaseTag = event.tags?.find(tag => tag.key === 'release');
  const environmentTag = event.tags?.find(tag => tag.key === 'environment');

  return items.length || screenshot ? (
    <Fragment>
      <IconBar>
        <ScrollCarousel gap={2} aria-label={t('Icon highlights')}>
          {screenshot && group && (
            <Fragment>
              <ScreenshotButton
                type="button"
                borderless
                size="zero"
                icon={<IconAttachment color="subText" />}
                title={t('View Screenshot')}
                onClick={() => {
                  const downloadUrl = `/api/0/projects/${organization.slug}/${group.project.slug}/events/${event.id}/attachments/${screenshot.id}/`;
                  openModal(
                    modalProps => (
                      <ScreenshotModal
                        {...modalProps}
                        projectSlug={group.project.slug}
                        eventAttachment={screenshot}
                        downloadUrl={downloadUrl}
                        attachments={attachments}
                      />
                    ),
                    {modalCss}
                  );
                }}
              >
                <IconDescription>{t('Screenshot')}</IconDescription>
              </ScreenshotButton>
              {items.length > 0 && <Divider />}
            </Fragment>
          )}
          {items.map((item, index) => (
            <IconContainer key={index}>
              <IconWrapper>{item.icon}</IconWrapper>
              <IconDescription>
                <div>{item.title}</div>
                {item.subtitle && (
                  <IconSubtitle title={`${item.contextTitle} ${item.subtitleType}`}>
                    {item.subtitle}
                  </IconSubtitle>
                )}
              </IconDescription>
            </IconContainer>
          ))}
          {releaseTag && projectSlug && projectId && (
            <IconContainer key="release">
              <IconWrapper>
                <IconReleases size="sm" color="subText" />
              </IconWrapper>
              <IconDescription aria-label={t('Event release')}>
                <VersionHoverCard
                  organization={organization}
                  projectSlug={projectSlug}
                  releaseVersion={releaseTag.value}
                >
                  <StyledVersion version={releaseTag.value} projectId={projectId} />
                </VersionHoverCard>
              </IconDescription>
            </IconContainer>
          )}
          {environmentTag && (
            <IconContainer key="environment">
              <IconWrapper>
                <IconWindow size="sm" color="subText" />
              </IconWrapper>
              <IconDescription aria-label={t('Event environment')}>
                <Tooltip title={t('Environment')}>{environmentTag.value}</Tooltip>
              </IconDescription>
            </IconContainer>
          )}
        </ScrollCarousel>
      </IconBar>
      <SectionDivider style={{marginTop: space(1)}} />
    </Fragment>
  ) : null;
}

const IconBar = styled('div')`
  position: relative;
  padding: 0 ${space(0.5)};
`;

const IconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-shrink: 0;
  min-height: 24px;
`;

const IconDescription = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('div')`
  flex: none;
  line-height: 1;
`;

const IconSubtitle = styled(Tooltip)`
  display: block;
  color: ${p => p.theme.subText};
`;

const StyledVersion = styled(Version)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const ScreenshotButton = styled(Button)`
  font-weight: normal;
`;
