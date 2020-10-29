import React from 'react';
import {Link} from 'react-router';
import {LocationDescriptor} from 'history';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import isPropValid from '@emotion/is-prop-valid';

import {TagSegment} from 'app/actionCreators/events';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {percent} from 'app/utils';
import Tooltip from 'app/components/tooltip';
import Version from 'app/components/version';

type DefaultProps = {
  isLoading: boolean;
  showReleasePackage: boolean;
  hasError: boolean;
  renderLoading: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
  renderError: () => React.ReactNode;
};

type Props = DefaultProps & {
  title: string;
  segments: TagSegment[];
  totalValues: number;
  onTagClick?: (title: string, value: TagSegment) => void;
};

type SegmentValue = {
  to: LocationDescriptor;
  onClick: () => void;
  index: number;
};

export default class TagDistributionMeter extends React.Component<Props> {
  static propTypes = {
    title: PropTypes.string.isRequired,
    totalValues: PropTypes.number,
    isLoading: PropTypes.bool,
    hasError: PropTypes.bool,
    segments: PropTypes.arrayOf(
      PropTypes.shape({
        count: PropTypes.number.isRequired,
        name: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
        url: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
      })
    ).isRequired,
    renderEmpty: PropTypes.func,
    renderLoading: PropTypes.func,
    renderError: PropTypes.func,
    onTagClick: PropTypes.func,
  };

  static defaultProps: DefaultProps = {
    isLoading: false,
    hasError: false,
    renderLoading: () => null,
    renderEmpty: () => <p>{t('No recent data.')}</p>,
    renderError: () => null,
    showReleasePackage: false,
  };

  renderTitle() {
    const {
      segments,
      totalValues,
      title,
      isLoading,
      hasError,
      showReleasePackage,
    } = this.props;

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
              if (onTagClick) {
                onTagClick(title, value);
              }
            },
          };

          return (
            <div key={value.value} style={{width: pct + '%'}}>
              <Tooltip title={tooltipHtml} containerDisplayMode="block">
                {value.isOther ? <OtherSegment /> : <Segment {...segmentProps} />}
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
`;

const TitleType = styled('div')`
  color: ${p => p.theme.gray700};
  font-weight: bold;
  ${overflowEllipsis};
`;

const TitleDescription = styled('div')`
  display: flex;
  color: ${p => p.theme.gray500};
  text-align: right;
`;

const Label = styled('div')`
  ${overflowEllipsis};
  max-width: 150px;
`;

const Percent = styled('div')`
  font-weight: bold;
  padding-left: ${space(0.5)};
  color: ${p => p.theme.gray700};
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
