import type React from 'react';
import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';

import {LinkButton} from 'sentry/components/button';
import {DeviceName} from 'sentry/components/deviceName';
import Link from 'sentry/components/links/link';
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
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useGroupTagsReadable} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {usePrefetchTagValues} from 'sentry/views/issueDetails/utils';

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
const RTL_TAGS = ['transaction', 'url'];

type Segment = {
  count: number;
  name: string | React.ReactNode;
  percentage: number;
  color?: string;
};

const bgColor = (index: number) =>
  Color(CHART_PALETTE[4].at(index)).alpha(0.8).toString();
const getRoundedPercentage = (percentage: number) =>
  percentage < 1 ? '<1%' : `${Math.floor(percentage)}%`;

function SegmentedBar({segments}: {segments: Segment[]}) {
  return (
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
  );
}

function TagPreviewProgressBar({tag, groupId}: {groupId: string; tag: GroupTag}) {
  const theme = useTheme();
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  const [isHovered, setIsHovered] = useState(false);
  const [prefetchTagValue, setPrefetchTagValue] = useState('');

  usePrefetchTagValues(prefetchTagValue, groupId, isHovered);
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

  const topPercentageString = getRoundedPercentage(topSegment.percentage);
  const otherPercentage = segments.reduce((sum, s) => sum - s.percentage, 100);
  const otherPercentageString =
    otherPercentage === 0 ? null : getRoundedPercentage(otherPercentage);

  const tooltipContent = (
    <TooltipLegend>
      <LegendTitle>{tag.key}</LegendTitle>
      <LegendGrid>
        {segments.map((segment, idx) => (
          <Fragment key={idx}>
            <LegendColor style={{backgroundColor: bgColor(idx)}} />
            <LegendText ellipsisDirection={RTL_TAGS.includes(tag.key) ? 'left' : 'right'}>
              {segment.name}
            </LegendText>
            <LegendPercentage>
              {getRoundedPercentage(segment.percentage)}
            </LegendPercentage>
          </Fragment>
        ))}
        {otherPercentageString && (
          <Fragment>
            <LegendColor style={{backgroundColor: theme.gray200}} />
            <LegendText>{t('Other')}</LegendText>
            <LegendPercentage>{otherPercentageString}</LegendPercentage>
          </Fragment>
        )}
      </LegendGrid>
    </TooltipLegend>
  );

  return (
    <Tooltip title={tooltipContent} skipWrapper maxWidth={420}>
      <TagPreviewGrid
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.TAGS]}${tag.key}/`,
          query: location.query,
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          setPrefetchTagValue(tag.key);
        }}
      >
        <TagBarPlaceholder>
          <SegmentedBar segments={segments} />
        </TagBarPlaceholder>
        <TopPercentage>{topPercentageString}</TopPercentage>
        <TextOverflow ellipsisDirection={RTL_TAGS.includes(tag.key) ? 'left' : 'right'}>
          {topSegment?.name}
        </TextOverflow>
      </TagPreviewGrid>
    </Tooltip>
  );
}

function IssueTagButton({tags, searchQuery}: {tags: GroupTag[]; searchQuery?: string}) {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();
  if (tags.length === 0 || searchQuery) {
    return (
      <VerticalIssueTagsButton
        aria-label={t('View issue tag distributions')}
        size="xs"
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
          query: location.query,
        }}
        replace
        disabled={tags.length === 0}
      >
        {t('All Tags')}
      </VerticalIssueTagsButton>
    );
  }

  return (
    <IssueTagsButton
      aria-label={t('View issue tag distributions')}
      size="xs"
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
        query: location.query,
      }}
      replace
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
  const organization = useOrganization();

  const {data: detailedProject, isPending: isHighlightPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const highlightTagKeys = useMemo(() => {
    const tagKeys = detailedProject?.highlightTags ?? project?.highlightTags ?? [];
    const highlightDefaults =
      detailedProject?.highlightPreset?.tags ?? project?.highlightPreset?.tags ?? [];
    return tagKeys.filter(tag => !highlightDefaults.includes(tag));
  }, [detailedProject, project]);

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

    const highlightTags = tags
      .filter(tag => highlightTagKeys.includes(tag.key))
      .sort((a, b) => highlightTagKeys.indexOf(a.key) - highlightTagKeys.indexOf(b.key));

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

    const remainingTagKeys = tags.filter(tag => !priorityTags.includes(tag.key)).sort();
    const orderedTags = [...highlightTags, ...sortedTags, ...remainingTagKeys];
    const uniqueTags = [...new Set(orderedTags)];
    return uniqueTags.slice(0, 4);
  }, [tags, project?.platform, highlightTagKeys]);

  if (isPending || isHighlightPending) {
    return (
      <Fragment>
        <SectionDivider />
        <IssueTagPreviewSection>
          <Placeholder width="240px" height="100px" />
        </IssueTagPreviewSection>
      </Fragment>
    );
  }

  if (isError) {
    return null;
  }

  if (tagsToPreview.length === 0 || searchQuery) {
    return <IssueTagButton tags={tagsToPreview} searchQuery={searchQuery} />;
  }

  return (
    <Fragment>
      <SectionDivider />
      <IssueTagPreviewSection>
        <TagsPreview>
          {tagsToPreview.map(tag => (
            <TagPreviewProgressBar key={tag.key} tag={tag} groupId={groupId} />
          ))}
        </TagsPreview>
        <IssueTagButton tags={tagsToPreview} />
      </IssueTagPreviewSection>
    </Fragment>
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

const TagPreviewGrid = styled(Link)`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  align-items: center;
  padding: 0 ${space(0.75)};
  margin: 0 -${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};

  &:hover {
    background: ${p => p.theme.backgroundTertiary};
    color: ${p => p.theme.textColor};
  }
`;

const LegendText = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
`;

const LegendPercentage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`;

const LegendTitle = styled('div')`
  font-weight: 600;
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

const VerticalIssueTagsButton = styled(LinkButton)`
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

const SectionDivider = styled('div')`
  border-left: 1px solid ${p => p.theme.translucentBorder};
  display: flex;
  align-items: center;
  margin: ${space(1)};
`;
