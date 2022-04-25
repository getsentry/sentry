import * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {TagSegment} from 'sentry/actionCreators/events';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {percent} from 'sentry/utils';

type DefaultProps = {
  hasError: boolean;
  isLoading: boolean;
  renderEmpty: () => React.ReactNode;
  renderError: () => React.ReactNode;
  renderLoading: () => React.ReactNode;
  showReleasePackage: boolean;
};

type Props = DefaultProps & {
  segments: TagSegment[];
  title: string;
  totalValues: number;
  onTagClick?: (title: string, value: TagSegment) => void;
};

type SegmentValue = {
  index: number;
  onClick: () => void;
  to: LocationDescriptor;
};

export default class TagDistributionMeter extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    isLoading: false,
    hasError: false,
    renderLoading: () => null,
    renderEmpty: () => <p>{t('No recent data.')}</p>,
    renderError: () => null,
    showReleasePackage: false,
  };

  renderTitle() {
    const {segments, totalValues, title, isLoading, hasError, showReleasePackage} =
      this.props;

    if (!Array.isArray(segments) || segments.length <= 0) {
      return (
        <Title>
          <TitleType>{title}</TitleType>
        </Title>
      );
    }

    const largestSegment = segments[0];
    const pct = percent(largestSegment.count, totalValues);
    const pctLabel = Math.floor(pct);
    const renderLabel = () => {
      switch (title) {
        case 'release':
          return (
            <Label>
              <Version
                version={largestSegment.name}
                anchor={false}
                tooltipRawVersion
                withPackage={showReleasePackage}
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
        <TitleDescription>
          {renderLabel()}
          {isLoading || hasError ? null : <Percent>{pctLabel}%</Percent>}
        </TitleDescription>
      </Title>
    );
  }

  renderSegments() {
    const {
      segments,
      onTagClick,
      title,
      isLoading,
      hasError,
      totalValues,
      renderLoading,
      renderError,
      renderEmpty,
      showReleasePackage,
    } = this.props;

    if (isLoading) {
      return renderLoading();
    }

    if (hasError) {
      return <SegmentBar>{renderError()}</SegmentBar>;
    }

    if (totalValues === 0) {
      return <SegmentBar>{renderEmpty()}</SegmentBar>;
    }

    return (
      <SegmentBar>
        {segments.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);
          const renderTooltipValue = () => {
            switch (title) {
              case 'release':
                return (
                  <Version
                    version={value.name}
                    anchor={false}
                    withPackage={showReleasePackage}
                  />
                );
              default:
                return value.name || t('n/a');
            }
          };

          const tooltipHtml = (
            <React.Fragment>
              <div className="truncate">{renderTooltipValue()}</div>
              {pctLabel}%
            </React.Fragment>
          );

          const segmentProps: SegmentValue = {
            index,
            to: value.url,
            onClick: () => {
              onTagClick?.(title, value);
            },
          };

          return (
            <div
              data-test-id={`tag-${title}-segment-${value.value}`}
              key={value.value}
              style={{width: pct + '%'}}
            >
              <Tooltip title={tooltipHtml} containerDisplayMode="block">
                {value.isOther ? (
                  <OtherSegment aria-label={t('Other')} />
                ) : (
                  <Segment
                    aria-label={t(
                      'Add the %s segment tag to the search query',
                      value.value
                    )}
                    {...segmentProps}
                  />
                )}
              </Tooltip>
            </div>
          );
        })}
      </SegmentBar>
    );
  }

  render() {
    const {segments, totalValues} = this.props;

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
        {this.renderTitle()}
        {this.renderSegments()}
      </TagSummary>
    );
  }
}

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
];

const TagSummary = styled('div')`
  margin-bottom: ${space(1)};
`;

const SegmentBar = styled('div')`
  display: flex;
  overflow: hidden;
  border-radius: 2px;
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
  ${overflowEllipsis};
`;

const TitleDescription = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  text-align: right;
`;

const Label = styled('div')`
  ${overflowEllipsis};
  max-width: 150px;
`;

const Percent = styled('div')`
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  padding-left: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;

const OtherSegment = styled('span')`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;
  outline: none;
  background-color: ${COLORS[COLORS.length - 1]};
`;

const Segment = styled(Link, {shouldForwardProp: isPropValid})<SegmentValue>`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;
  outline: none;
  background-color: ${p => COLORS[p.index]};
`;
