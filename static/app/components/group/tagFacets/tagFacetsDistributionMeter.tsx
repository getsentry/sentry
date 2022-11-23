import {useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {TagSegment} from 'sentry/actionCreators/events';
import Link from 'sentry/components/links/link';
import {SegmentValue} from 'sentry/components/tagDistributionMeter';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {percent} from 'sentry/utils';

const COLORS = [
  '#3A3387',
  '#5F40A3',
  '#8C4FBD',
  '#B961D3',
  '#DE76E4',
  '#EF91E8',
  '#F7B2EC',
  '#FCD8F4',
  '#FEEBF9',
  '#FFF7FD',
];

type Props = {
  segments: TagSegment[];
  title: string;
  totalValues: number;
  colors?: string[];
  onTagClick?: (title: string, value: TagSegment) => void;
};

function TagFacetsDistributionMeter({
  colors = COLORS,
  segments,
  title,
  totalValues,
  onTagClick,
}: Props) {
  const [expanded, setExpanded] = useState<boolean>(false);

  function renderTitle() {
    if (!Array.isArray(segments) || segments.length <= 0) {
      return (
        <Title>
          <TitleType>{title}</TitleType>
        </Title>
      );
    }

    const largestSegment = segments[0];
    const renderLabel = () => {
      switch (title) {
        case 'release':
          return (
            <Label>
              <Version
                version={largestSegment.name}
                anchor={false}
                tooltipRawVersion
                truncate
              />
            </Label>
          );
        default:
          return <Label>{largestSegment.name || t('n/a')}</Label>;
      }
    };

    return (
      <Title>
        <TitleType>{title}</TitleType>
        <TitleDescription>{renderLabel()}</TitleDescription>
        <StyledChevron
          direction={expanded ? 'up' : 'down'}
          size="md"
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
            onClick: () => onTagClick?.(title, value),
          };
          return (
            <div key={value.value} style={{width: pct + '%'}}>
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

  return (
    <TagSummary>
      {renderTitle()}
      {!expanded ? renderSegments() : null}
      {expanded ? renderLegend() : null}
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
  max-width: 150px;
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

const StyledChevron = styled(IconChevron)`
  margin: -${space(0.5)} 0 0 ${space(0.5)};
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
