import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {TagSegment} from 'sentry/actionCreators/events';
import Link from 'sentry/components/links/link';
import {SegmentValue} from 'sentry/components/tagDistributionMeter';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {percent} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {isMobilePlatform} from 'sentry/utils/platform';
import useOrganization from 'sentry/utils/useOrganization';

import {TagFacetsStyles} from '.';

const COLORS = ['#402A65', '#694D99', '#9A81C4', '#BBA6DF', '#EAE2F8'];

type Props = {
  project: Project;
  segments: TagSegment[];
  title: string;
  totalValues: number;
  colors?: string[];
  onTagClick?: (title: string, value: TagSegment) => void;
};

const _debounceTrackHover = debounce(
  ({
    tag,
    value,
    platform,
    is_mobile,
    organization,
    type,
  }: {
    is_mobile: boolean;
    organization: Organization;
    tag: string;
    type: TagFacetsStyles;
    value: string;
    platform?: string;
  }) => {
    trackAdvancedAnalyticsEvent('issue_group_details.tags.bar.hovered', {
      tag,
      value,
      platform,
      is_mobile,
      organization,
      type,
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
}: Props) {
  const organization = useOrganization();
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
                platform: project.platform,
                is_mobile: isMobilePlatform(project?.platform),
                organization,
                type: 'distributions',
              });
              return onTagClick?.(title, value);
            },
          };
          return (
            <div
              key={value.value}
              style={{width: pct + '%'}}
              onMouseOver={() =>
                _debounceTrackHover({
                  tag: title,
                  value: value.value,
                  platform: project.platform,
                  is_mobile: isMobilePlatform(project?.platform),
                  organization,
                  type: 'distributions',
                })
              }
            >
              <Tooltip
                title={renderLegend(true)}
                containerDisplayMode="block"
                position="bottom"
              >
                {value.isOther ? (
                  <OtherSegment
                    aria-label={t('Other')}
                    color={colors[colors.length - 1]}
                  />
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
                    {index === 0 ? `${pctLabel}%` : null}
                  </Segment>
                )}
              </Tooltip>
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
          return (
            <LegendRow key={`segment-${segment.name}-${index}`} tooltip={tooltip}>
              <LegendDot color={colors[index]} />
              <LegendText>{segment.name}</LegendText>
              <LegendPercent>{`${pctLabel}%`}</LegendPercent>
            </LegendRow>
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
`;

const Title = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: space-between;
  margin-bottom: ${space(0.25)};
  line-height: 1.1;
`;

const TitleType = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: bold;
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TitleDescription = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  text-align: right;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Label = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const OtherSegment = styled('span')<{color: string}>`
  display: block;
  width: 100%;
  height: 16px;
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
  height: 16px;
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
  row-gap: ${space(1)};
  margin: ${space(1)} 0;
`;

const LegendRow = styled('div')<{tooltip: boolean}>`
  display: flex;
  align-items: center;
  ${p => (p.tooltip ? 'max-width: 200px' : '')}
`;

const LegendDot = styled('span')<{color: string}>`
  padding: 0;
  position: relative;
  width: 11px;
  height: 11px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.color};
`;

const LegendText = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const LegendPercent = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
  color: ${p => p.theme.gray300};
  text-align: right;
  flex-grow: 1;
`;
