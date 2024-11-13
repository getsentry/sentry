import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {
  getContextIcon,
  getContextSummary,
  getContextTitle,
} from 'sentry/components/events/contexts/utils';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconReleases, IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

interface HighlightsIconSummaryProps {
  event: Event;
  group?: Group;
}

export function HighlightsIconSummary({event, group}: HighlightsIconSummaryProps) {
  const organization = useOrganization();
  // Hide device for non-native platforms since it's mostly duplicate of the client_os or os context
  const shouldDisplayDevice =
    isMobilePlatform(event.platform) || isNativePlatform(event.platform);
  // For now, highlight icons are only interpretted from context. We should extend this to tags
  // eventually, but for now, it'll match the previous expectations.
  const items = getOrderedContextItems(event)
    .map(({alias, type, value}) => ({
      ...getContextSummary({type, value}),
      contextTitle: getContextTitle({alias, type, value}),
      alias,
      icon: getContextIcon({
        alias,
        type,
        value,
        contextIconProps: {
          size: 'md',
        },
      }),
    }))
    .filter(item => {
      const hasData = item.icon !== null && Boolean(item.title || item.subtitle);
      if (item.alias === 'device') {
        return hasData && shouldDisplayDevice;
      }

      return hasData;
    });

  const releaseTag = event.tags?.find(tag => tag.key === 'release');
  const environmentTag = event.tags?.find(tag => tag.key === 'environment');

  return items.length ? (
    <Fragment>
      <IconBar>
        <ScrollCarousel gap={3} aria-label={t('Icon highlights')}>
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
          {releaseTag && (
            <IconContainer key="release">
              <IconWrapper>
                <IconReleases size="sm" color="subText" />
              </IconWrapper>
              <IconDescription aria-label={t('Event release')}>
                {group && releaseTag && (
                  <VersionHoverCard
                    organization={organization}
                    projectSlug={group.project.slug}
                    releaseVersion={releaseTag.value}
                  >
                    <StyledVersion
                      version={releaseTag.value}
                      projectId={group.project.id}
                    />
                  </VersionHoverCard>
                )}
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
  padding: ${space(0.5)} ${space(0.5)};
`;

const IconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-shrink: 0;
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
