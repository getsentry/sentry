import {useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {TagSegment} from 'sentry/actionCreators/events';
import Link from 'sentry/components/links/link';
import {SegmentValue} from 'sentry/components/tagDistributionMeter';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {percent} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {isMobilePlatform} from 'sentry/utils/platform';
import useOrganization from 'sentry/utils/useOrganization';

const COLORS = ['#3A3387', '#5F40A3', '#8C4FBD', '#B961D3', '#FEEBF9'];

type Props = {
  segments: TagSegment[];
  title: string;
  totalValues: number;
  colors?: string[];
  expandByDefault?: boolean;
  onTagClick?: (title: string, value: TagSegment) => void;
  project?: Project;
};

const _debounceTrackHover = debounce(
  ({
    tag,
    value,
    platform,
    is_mobile,
    organization,
  }: {
    is_mobile: boolean;
    organization: Organization;
    tag: string;
    value: string;
    platform?: string;
  }) => {
    trackAdvancedAnalyticsEvent('issue_group_details.tags.bar.hovered', {
      tag,
      value,
      platform,
      is_mobile,
      organization,
    });
  },
  300
);

function TagFacetsDistributionMeter({
  colors = COLORS,
  segments,
  title,
  totalValues,
  onTagClick,
  project,
  expandByDefault,
}: Props) {
  const organization = useOrganization();
  const [expanded, setExpanded] = useState<boolean>(!!expandByDefault);
  const [hoveredValue, setHoveredValue] = useState<TagSegment | null>(null);

  function renderTitle() {
    if (!Array.isArray(segments) || segments.length <= 0) {
      return (
        <Title>
          <TitleType>{title}</TitleType>
        </Title>
      );
    }

    return (
      <Title>
        <TitleType>{title}</TitleType>
        <TitleDescription>
          <Label>{segments[0].name || t('n/a')}</Label>
        </TitleDescription>
        <StyledChevron
          direction={expanded ? 'up' : 'down'}
          size="xs"
          onClick={() => {
            setExpanded(!expanded);
          }}
          aria-label={`expand-${title}`}
        />
      </Title>
    );
  }

  function renderSegments() {
    if (totalValues === 0) {
      return (
        <SegmentBar>
          <p>{t('No recent data.')}</p>
        </SegmentBar>
      );
    }

    return (
      <SegmentBar>
        {segments.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);
          const segmentProps: SegmentValue = {
            index,
            to: value.url,
            onClick: () => {
              trackAdvancedAnalyticsEvent('issue_group_details.tags.bar.clicked', {
                tag: title,
                value: value.value,
                platform: project?.platform,
                is_mobile: isMobilePlatform(project?.platform),
                organization,
              });
              return onTagClick?.(title, value);
            },
          };
          return (
            <div
              key={value.value}
              style={{width: pct + '%'}}
              onMouseOver={() => {
                setHoveredValue(value);
                _debounceTrackHover({
                  tag: title,
                  value: value.value,
                  platform: project?.platform,
                  is_mobile: isMobilePlatform(project?.platform),
                  organization,
                });
              }}
              onMouseLeave={() => setHoveredValue(null)}
            >
              {value.isOther ? (
                <OtherSegment aria-label={t('Other')} color={colors[colors.length - 1]} />
              ) : (
                <Segment
                  aria-label={t(
                    'Add the %s %s segment tag to the search query',
                    title,
                    value.value
                  )}
                  color={colors[index]}
                  {...segmentProps}
                >
                  {/* if the first segment is 6% or less, the label won't fit cleanly into the segment, so don't show the label */}
                  {index === 0 && pctLabel > 6 ? `${pctLabel}%` : null}
                </Segment>
              )}
            </div>
          );
        })}
      </SegmentBar>
    );
  }

  function renderLegend(tooltip: boolean = false) {
    return (
      <LegendGrid>
        {segments.map((segment, index) => {
          const pctLabel = Math.floor(percent(segment.count, totalValues));
          const unfocus = !!hoveredValue && hoveredValue !== segment;
          const focus = hoveredValue === segment;
          return (
            <Link key={`segment-${segment.name}-${index}`} to={segment.url}>
              <LegendRow
                tooltip={tooltip}
                onMouseOver={() => setHoveredValue(segment)}
                onMouseLeave={() => setHoveredValue(null)}
              >
                <LegendDot color={colors[index]} focus={focus} />
                <LegendText unfocus={unfocus}>{segment.name}</LegendText>
                <LegendPercent>{`${pctLabel}%`}</LegendPercent>
              </LegendRow>
            </Link>
          );
        })}
      </LegendGrid>
    );
  }

  const totalVisible = segments.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < totalValues;

  if (hasOther) {
    segments.push({
      isOther: true,
      name: t('Other'),
      value: 'other',
      count: totalValues - totalVisible,
      url: '',
    });
  }

  return (
    <TagSummary>
      {renderTitle()}
      {renderSegments()}
      {expanded && renderLegend()}
    </TagSummary>
  );
}

export default TagFacetsDistributionMeter;

const TagSummary = styled('div')`
  margin-bottom: ${space(2)};
`;

const SegmentBar = styled('div')`
  display: flex;
  overflow: hidden;
  border-radius: ${space(0.75)};
`;

const Title = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: space-between;
  margin-bottom: ${space(0.25)};
  line-height: 1.1;
`;

const TitleType = styled('div')`
  flex: none;
  color: ${p => p.theme.textColor};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeSmall};
  margin-right: ${space(1)};
`;

const TitleDescription = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  text-align: right;
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
`;

const Label = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const OtherSegment = styled('span')<{color: string}>`
  display: block;
  width: 100%;
  height: ${space(2)};
  color: inherit;
  outline: none;
  background-color: ${p => p.color};
`;

const Segment = styled(Link, {shouldForwardProp: isPropValid})<{color: string}>`
  &:hover {
    color: ${p => p.theme.white};
  }
  display: block;
  width: 100%;
  height: ${space(2)};
  color: ${p => p.theme.white};
  outline: none;
  background-color: ${p => p.color};
  border-radius: 0;
  text-align: right;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 1px ${space(0.5)} 0 0;
`;

const LegendGrid = styled('div')`
  display: grid;
  margin: ${space(1)} 0;
`;

const LegendRow = styled('div')<{tooltip: boolean}>`
  display: flex;
  align-items: center;
  ${p => (p.tooltip ? 'max-width: 200px' : '')}
  cursor: pointer;
  padding: ${space(0.5)} 0;
  max-width: 295px;
`;

const LegendDot = styled('span')<{color: string; focus: boolean}>`
  padding: 0;
  position: relative;
  width: 11px;
  height: 11px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.color};
  transition: outline 0.3s;
  ${p => (p.focus ? `outline: ${p.theme.gray100} ${space(0.5)} solid` : null)}
`;

const LegendText = styled('span')<{unfocus: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.3s;
  color: ${p => (p.unfocus ? p.theme.gray300 : p.theme.gray400)};
`;

const LegendPercent = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
  color: ${p => p.theme.gray300};
  text-align: right;
  flex-grow: 1;
`;

const StyledChevron = styled(IconChevron)`
  margin: -${space(0.5)} 0 0 ${space(0.5)};
  color: ${p => p.theme.gray300};
  min-width: ${space(1.5)};
  margin-top: 0;
`;
