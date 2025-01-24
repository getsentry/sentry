import type React from 'react';
import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {LinkButton} from 'sentry/components/button';
import {DeviceName} from 'sentry/components/deviceName';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {backend, frontend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {percent} from 'sentry/utils';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useLocation} from 'sentry/utils/useLocation';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useGroupTagsReadable} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

const DEFAULT_TAGS = ['transaction', 'environment', 'release'];
const FRONTEND_TAGS = ['browser', 'release', 'url', 'environment'];
const BACKEND_TAGS = [
  'transaction',
  'url',
  'user',
  'release',
  'organization.slug',
  'environment',
];
const MOBILE_TAGS = ['device', 'os', 'release', 'environment', 'transaction'];

type Segment = {
  count: number;
  name: string | React.ReactNode;
  percentage: number;
  color?: string;
};

const bgColor = (index: number) =>
  Color(CHART_PALETTE[4].at(index)).alpha(0.8).toString();

function SegmentedBar({
  segments,
  otherPercentage,
  tagName,
}: {
  otherPercentage: string | null;
  segments: Segment[];
  tagName: string;
}) {
  const theme = useTheme();
  const tooltipContent = (
    <TooltipLegend>
      <LegendTitle>{tagName}</LegendTitle>
      <LegendGrid>
        {segments.map((segment, idx) => (
          <Fragment key={idx}>
            <LegendColor style={{backgroundColor: bgColor(idx)}} />
            <LegendText>{segment.name}</LegendText>
            <LegendPercentage>{segment.percentage.toFixed(0)}%</LegendPercentage>
          </Fragment>
        ))}
        {otherPercentage && (
          <Fragment>
            <LegendColor style={{backgroundColor: theme.gray200}} />
            <LegendText>{t('Other')}</LegendText>
            <LegendPercentage>{otherPercentage}</LegendPercentage>
          </Fragment>
        )}
      </LegendGrid>
    </TooltipLegend>
  );

  return (
    <Tooltip title={tooltipContent} skipWrapper>
      <TagBarPlaceholder>
        {segments.map((segment, idx) => (
          <TagBarSegment
            key={idx}
            style={{
              left: `${segments.slice(0, idx).reduce((sum, s) => sum + s.percentage, 0)}%`,
              width: `${segment.percentage}%`,
              backgroundColor: bgColor(idx),
            }}
          />
        ))}
      </TagBarPlaceholder>
    </Tooltip>
  );
}

function TagPreviewProgressBar({tag}: {tag: GroupTag}) {
  const segments: Segment[] = tag.topValues.map(value => {
    let name: string | React.ReactNode = value.name;
    if (tag.key === 'release') {
      name = formatVersion(value.name);
    } else if (tag.key === 'device') {
      name = <DeviceName value={value.name} />;
    }

    return {
      name,
      percentage: percent(value.count, tag.totalValues),
      count: value.count,
    };
  });

  const topSegment = segments[0];
  if (!topSegment) {
    return null;
  }

  const topPercentageString =
    topSegment.percentage < 1 ? '<1%' : `${topSegment.percentage.toFixed(0)}%`;
  const otherPercentage = segments.reduce((sum, s) => sum - s.percentage, 100);
  const otherPercentageString =
    otherPercentage === 0
      ? null
      : otherPercentage < 1
        ? '<1%'
        : `${otherPercentage.toFixed(0)}%`;

  return (
    <Fragment>
      <TagBarPlaceholder>
        <SegmentedBar
          segments={segments}
          otherPercentage={otherPercentageString}
          tagName={tag.key}
        />
      </TagBarPlaceholder>
      <TopPercentage>{topPercentageString}</TopPercentage>
      <TextOverflow>{topSegment?.name}</TextOverflow>
    </Fragment>
  );
}

function IssueTagButton({tags}: {tags: GroupTag[]}) {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  if (tags.length === 0) {
    return (
      <HorizontalIssueTagsButton
        aria-label={t('View issue tag distributions')}
        size="xs"
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
          query: location.query,
          replace: true,
        }}
        disabled
      >
        {t('All Tags')}
      </HorizontalIssueTagsButton>
    );
  }

  return (
    <IssueTagsButton
      aria-label={t('View issue tag distributions')}
      size="xs"
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
        query: location.query,
        replace: true,
      }}
      analyticsEventKey="issue_details.issue_tags_clicked"
      analyticsEventName="Issue Details: Issue Tags Clicked"
    >
      {t('All Tags')}
    </IssueTagsButton>
  );
}

export default function IssueTagsPreview({
  groupId,
  environments,
  project,
}: {
  environments: string[];
  groupId: string;
  project: Project;
}) {
  const searchQuery = useEventQuery({groupId});

  const {
    isError,
    isPending,
    data: tags,
  } = useGroupTagsReadable({
    groupId,
    environment: environments,
  });
  const tagsToPreview = useMemo(() => {
    if (!tags) {
      return [];
    }

    const priorityTags = isMobilePlatform(project?.platform)
      ? MOBILE_TAGS
      : frontend.some(val => val === project?.platform)
        ? FRONTEND_TAGS
        : backend.some(val => val === project?.platform)
          ? BACKEND_TAGS
          : DEFAULT_TAGS;
    // Sort tags based on priority order defined in priorityTags array
    const sortedTags = tags
      .filter(tag => priorityTags.includes(tag.key))
      .sort((a, b) => priorityTags.indexOf(a.key) - priorityTags.indexOf(b.key));

    return sortedTags.slice(0, 4);
  }, [tags, project?.platform]);

  if (isPending) {
    return (
      <IssueTagPreviewSection>
        <Placeholder width="240px" height="100px" />
      </IssueTagPreviewSection>
    );
  }

  if (isError || searchQuery) {
    return null;
  }

  if (tagsToPreview.length === 0) {
    return <IssueTagButton tags={tagsToPreview} />;
  }

  return (
    <IssueTagPreviewSection>
      <TagsPreview>
        {tagsToPreview.map(tag => (
          <TagPreviewProgressBar key={tag.key} tag={tag} />
        ))}
      </TagsPreview>
      <IssueTagButton tags={tagsToPreview} />
    </IssueTagPreviewSection>
  );
}

const IssueTagPreviewSection = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${space(0.5)};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(0.5)};
`;

const TagsPreview = styled('div')`
  width: 240px;
  display: grid;
  grid-template-columns: 45% min-content auto;
  align-items: center;
  align-content: center;
  gap: 1px;
  column-gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const TagBarPlaceholder = styled('div')`
  position: relative;
  height: 8px;
  width: 100%;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px ${p => p.theme.translucentBorder};
  background: ${p => Color(p.theme.gray300).alpha(0.1).toString()};
  overflow: hidden;
`;

const TagBarSegment = styled('div')`
  height: 100%;
  position: absolute;
  top: 0;
  min-width: ${space(0.25)};
  border-right: 1px solid ${p => p.theme.translucentBorder};

  &:last-child {
    border-right: none;
  }
`;

const TopPercentage = styled('div')`
  text-align: right;
  margin-left: ${space(0.25)};
  font-variant-numeric: tabular-nums;
`;

const TooltipLegend = styled('div')`
  padding: ${space(0.5)} ${space(1)};
`;

const LegendGrid = styled('div')`
  display: grid;
  grid-template-columns: min-content auto min-content;
  gap: ${space(0.5)} ${space(1)};
  align-items: center;
  text-align: left;
`;

const LegendColor = styled('div')`
  width: 10px;
  height: 10px;
  border-radius: 100%;
`;

const LegendText = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  ${p => p.theme.overflowEllipsis};
`;

const LegendPercentage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`;

const LegendTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.75)};
`;

const IssueTagsButton = styled(LinkButton)`
  display: block;
  flex: 0;
  height: unset;
  text-align: center;
  span {
    white-space: unset;
  }
`;

const HorizontalIssueTagsButton = styled(LinkButton)`
  display: block;
  flex: 0;
  margin: ${space(1)} ${space(2)} ${space(1)} ${space(1)};
  padding: ${space(1)} ${space(1.5)};
  text-align: center;
  width: 58px;
  height: unset;
  span {
    white-space: unset;
  }
`;
