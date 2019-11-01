import React from 'react';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import isPropValid from '@emotion/is-prop-valid';

import {t} from 'app/locale';
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
        name: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array])
          .isRequired,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array])
          .isRequired,
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

  renderSegments() {
    const {segments, totalValues, onTagClick, title} = this.props;

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
      <Segments>
        {segments.map((value, index) => {
          const pct = percent(value.count, totalValues);
          const pctLabel = Math.floor(pct);

          const tooltipHtml = (
            <React.Fragment>
              <div className="truncate">{value.name}</div>
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
                >
                  <Description first={index === 0}>
                    <Percentage>{pctLabel}%</Percentage>
                    <Label>{value.name}</Label>
                  </Description>
                </Segment>
              </Tooltip>
            </div>
          );
        })}
      </Segments>
    );
  }

  renderTag() {
    const {
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
      return renderError();
    }

    if (!totalValues) {
      return renderEmpty();
    }

    return this.renderSegments();
  }

  render() {
    const {title} = this.props;

    return (
      <DistributionGraph>
        <Title>{title}</Title>
        {this.renderTag()}
      </DistributionGraph>
    );
  }
}

const DistributionGraph = styled('div')`
  position: relative;
  font-size: 13px;
  margin-bottom: 10px;
`;

const Title = styled('div')`
  position: relative;
  font-size: 13px;
  margin: 10px 0 8px;
  font-weight: bold;
  z-index: 5;
  line-height: 1;
`;

const colors = [
  '#7c7484',
  '#867f90',
  '#918a9b',
  '#9b96a7',
  '#a6a1b3',
  '#b0acbe',
  '#bbb7ca',
  '#c5c3d6',
  '#d0cee1',
  '#dad9ed',
];

const Segments = styled('div')`
  display: flex;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const Segment = styled(Link, {shouldForwardProp: isPropValid})`
  display: block;
  width: 100%;
  height: 16px;
  color: inherit;

  &:hover,
  &.focus-visible {
    background: ${p => p.theme.purple};
    outline: none;
  }

  background-color: ${p => (p.isOther ? colors[colors.length - 1] : colors[p.index])};
`;

const Description = styled('span', {shouldForwardProp: isPropValid})`
  position: absolute;
  text-align: right;
  top: -1px;
  right: 0;
  line-height: 1;
  z-index: 1;
  width: 100%;
  display: ${p => (p.first ? 'block' : 'none')};

  &:hover {
    display: block;
    z-index: 2;
  }
`;

const Percentage = styled('span')`
  display: inline-block;
  margin-right: 6px;
  color: ${p => p.theme.gray2};
  vertical-align: middle;
`;

const Label = styled('span')`
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 45%;
  vertical-align: middle;
`;
