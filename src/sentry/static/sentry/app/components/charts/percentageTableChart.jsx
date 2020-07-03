import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Count from 'app/components/count';
import {IconChevron} from 'app/icons';
import TableChart from 'app/components/charts/tableChart';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const Delta = ({current, previous, className}) => {
  if (typeof previous === 'undefined') {
    return null;
  }
  const changePercent = Math.round((Math.abs(current - previous) / previous) * 100);
  const direction = !changePercent ? 0 : current - previous;
  return (
    <StyledDelta direction={direction} className={className}>
      {!!direction && (
        <IconChevron direction={direction > 0 ? 'up' : 'down'} size="10px" />
      )}
      {changePercent !== 0 ? `${changePercent}%` : <span>&mdash;</span>}
    </StyledDelta>
  );
};
Delta.propTypes = {
  current: PropTypes.number,
  previous: PropTypes.number,
};

const StyledDelta = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.25)};
  margin-right: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p =>
    p.direction > 0
      ? p.theme.green400
      : p.direction < 0
      ? p.theme.red400
      : p.theme.gray500};
`;

class PercentageTableChart extends React.Component {
  static propTypes = {
    // Main title (left most column) should
    title: PropTypes.node,

    // Label for the "count" title
    countTitle: PropTypes.node,

    extraTitle: PropTypes.node,
    onRowClick: PropTypes.func,

    // Class name for header
    headerClassName: PropTypes.string,

    // Class name for rows
    rowClassName: PropTypes.string,

    // If this is a function and returns a truthy value, then the row will be a link
    // to the return value of this function
    getRowLink: PropTypes.func,

    data: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.node,
        percentage: PropTypes.number,
        value: PropTypes.number,
        lastValue: PropTypes.number,
      })
    ),
  };

  static defaultProps = {
    title: '',
    countTitle: t('Count'),
    extraTitle: null,
    onRowClick: () => {},
  };

  handleRowClick = (obj, e) => {
    const {onRowClick} = this.props;
    onRowClick(obj, e);
  };

  render() {
    const {
      rowClassName,
      headerClassName,
      getRowLink,
      title,
      countTitle,
      extraTitle,
      data,
    } = this.props;

    return (
      <TableChart
        data={data.map(({value, lastValue, name, percentage}) => [
          <Name key="name">{name}</Name>,
          <CountColumn key="count">
            <Delta current={value} previous={lastValue} />
            <Count value={value} />
          </CountColumn>,
          <React.Fragment key="bar">
            <BarWrapper>
              <Bar width={percentage} />
            </BarWrapper>
            <Percentage>{percentage}%</Percentage>
          </React.Fragment>,
        ])}
        renderRow={({items, rowIndex}) => (
          <Row
            dataRowClassName={rowClassName}
            headerRowClassName={headerClassName}
            getRowLink={getRowLink}
            onClick={this.handleRowClick}
            data={data}
            rowIndex={rowIndex}
          >
            <NameAndCountContainer>
              {items[0]}
              <div>{items[1]}</div>
            </NameAndCountContainer>
            <PercentageContainer>
              <PercentageLabel>{items[2]}</PercentageLabel>
              {items[3]}
            </PercentageContainer>
          </Row>
        )}
      >
        {({renderRow, renderBody, ...props}) => (
          <TableChartWrapper>
            <TableHeader>
              {renderRow({
                isTableHeader: true,
                items: [title, countTitle, t('Percentage'), extraTitle],
                rowIndex: -1,
                ...props,
              })}
            </TableHeader>
            {renderBody({renderRow, ...props})}
          </TableChartWrapper>
        )}
      </TableChart>
    );
  }
}

const Row = styled(function RowComponent({
  headerRowClassName,
  dataRowClassName,
  className,
  data,
  getRowLink,
  rowIndex,
  onClick,
  children,
}) {
  const isLink = typeof getRowLink === 'function' && rowIndex > -1;
  const linkPath = isLink && getRowLink(data[rowIndex]);
  const Component = isLink ? Link : 'div';
  const rowProps = {
    className: classNames(
      className,
      rowIndex > -1 && dataRowClassName,
      rowIndex === -1 && headerRowClassName
    ),
    children,
    ...(linkPath && {
      to: linkPath,
    }),
    ...(!isLink &&
      typeof onClick === 'function' && {
        onClick: e => onClick(data[rowIndex], e),
      }),
  };

  return <Component {...rowProps} />;
})`
  display: flex;
  flex: 1;
  ${p => p.rowIndex > -1 && 'cursor: pointer'};
  font-size: 0.9em;
`;

const FlexContainers = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NameAndCountContainer = styled(FlexContainers)`
  flex-shrink: 0;
  margin-right: ${space(2)};
  width: 50%;
`;

const PercentageContainer = styled(FlexContainers)`
  width: 50%;
`;

const PercentageLabel = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const BarWrapper = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
  background-color: ${p => p.theme.gray100};
`;

const Percentage = styled('div')`
  flex-shrink: 0;
  text-align: right;
  width: 60px;
`;

const Bar = styled('div', {shouldForwardProp: isPropValid})`
  flex: 1;
  width: ${p => p.width}%;
  background-color: ${p => p.theme.gray400};
  height: 12px;
  border-radius: 2px;
`;

const Name = styled('span')`
  ${overflowEllipsis};
`;

const CountColumn = styled(Name)`
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
`;

const TableHeader = styled(PanelItem)`
  color: ${p => p.theme.gray500};
  padding: ${space(1)};
`;

const TableChartWrapper = styled('div')`
  margin-bottom: 0;
  padding: 0 ${space(2)};

  /* Fit to container dimensions */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  ${PanelItem} {
    padding: ${space(1)};
  }
`;

export default PercentageTableChart;
