import React from 'react';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {percent} from 'app/utils';
import Tooltip from 'app/components/tooltip';

export default class TagDistributionMeter extends React.Component {
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

  static defaultProps = {
    isLoading: false,
    hasError: false,
    renderLoading: () => null,
    renderEmpty: () => <p>{t('No recent data.')}</p>,
    renderError: () => null,
  };

  renderTitle() {
    const {segments, totalValues, title, isLoading, hasError} = this.props;

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

    return (
      <Title>
        <TitleType>{title}</TitleType>
        <TitleDescription>
          <Label>{largestSegment.name || t('n/a')}</Label>
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

          const tooltipHtml = (
            <React.Fragment>
              <div className="truncate">{value.name || t('n/a')}</div>
              {pctLabel}%
            </React.Fragment>
          );

          return (
            <div key={value.value} style={{width: pct + '%'}}>
              <Tooltip title={tooltipHtml} containerDisplayMode="block">
                <Segment
                  to={value.isOther ? null : value.url}
                  index={index}
                  isOther={!!value.isOther}
                  onClick={() => {
                    if (onTagClick) {
                      onTagClick(title, value);
                    }
                  }}
                />
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

const Title = styled('div', {shouldForwardProp: isPropValid})`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: space-between;
`;

const TitleType = styled('div')`
  color: ${p => p.theme.gray4};
  font-weight: bold;
`;

const TitleDescription = styled('div')`
  display: flex;
  color: ${p => p.theme.gray2};
  text-align: right;
`;

const Label = styled('div')`
  display: inline;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 150px;
`;

const Percent = styled('div')`
  font-weight: bold;
  padding-left: ${space(0.5)};
  color: ${p => p.theme.gray4};
`;

const Segment = styled(Link, {shouldForwardProp: isPropValid})`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;
  outline: none;
  background-color: ${p => (p.isOther ? COLORS[COLORS.length - 1] : COLORS[p.index])};
`;
