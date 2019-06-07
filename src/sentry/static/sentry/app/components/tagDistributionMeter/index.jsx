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
        name: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
        url: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
      })
    ).isRequired,
    renderEmpty: PropTypes.func,
    renderLoading: PropTypes.func,
    renderError: PropTypes.func,
  };

  static defaultProps = {
    isLoading: false,
    hasError: false,
    renderLoading: () => null,
    renderEmpty: () => <p>{t('No recent data.')}</p>,
    renderError: () => null,
  };

  renderSegments() {
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
      <React.Fragment>
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
            <Tooltip key={value.value} title={tooltipHtml} containerDisplayMode="inline">
              <Segment
                style={{width: pct + '%'}}
                to={value.isOther ? null : value.url}
                index={index}
                first={index === 0}
                last={index === segments.length - 1}
                isOther={!!value.isOther}
              >
                <Description first={index === 0}>
                  <Percentage>{pctLabel}%</Percentage>
                  <Label>{value.name}</Label>
                </Description>
              </Segment>
            </Tooltip>
          );
        })}
      </React.Fragment>
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

const Segment = styled(Link, {shouldForwardProp: isPropValid})`
  height: 16px;
  display: inline-block;
  color: inherit;

  &:hover {
    background: ${p => p.theme.purple};
  }

  border-top-left-radius: ${p => p.first && p.theme.borderRadius};
  border-bottom-left-radius: ${p => p.first && p.theme.borderRadius};

  border-top-right-radius: ${p => p.last && p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.last && p.theme.borderRadius};

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
  margin-right: 6px;
  color: ${p => p.theme.gray2};
  display: inline-block;
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
