import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

import BreadcrumbTime from './breadcrumbTime';
import BreadcrumbCollapsed from './breadcrumbCollapsed';
import BreadcrumbData from './breadcrumbData/breadcrumbData';
import BreadcrumbCategory from './breadcrumbCategory';
import BreadcrumbIcon from './breadcrumbIcon';
import BreadcrumbLevel from './breadcrumbLevel';
import {Grid, GridCell, GridCellLeft} from './styles';
import {Breadcrumb, BreadcrumbDetails, BreadcrumbType} from './types';

type Breadcrumbs = Array<Breadcrumb & BreadcrumbDetails & {id: number}>;

type Props = {
  breadcrumbs: Breadcrumbs;
  collapsedQuantity: number;
  onToggleCollapse: () => void;
};

type State = {
  breadCrumbListHeight?: React.CSSProperties['maxHeight'];
};

class BreadcrumbsListBody extends React.Component<Props, State> {
  state: State = {};

  componentDidMount() {
    this.loadBreadCrumbListHeight();
  }

  listRef = React.createRef<HTMLDivElement>();

  loadBreadCrumbListHeight = () => {
    const offsetHeight = this.listRef?.current?.offsetHeight;
    this.setState({
      breadCrumbListHeight: offsetHeight ? `${offsetHeight}px` : 'none',
    });
  };

  render() {
    const {collapsedQuantity, onToggleCollapse, breadcrumbs} = this.props;
    const {breadCrumbListHeight} = this.state;

    return (
      <Grid maxHeight={breadCrumbListHeight} ref={this.listRef}>
        {collapsedQuantity > 0 && (
          <BreadcrumbCollapsed onClick={onToggleCollapse} quantity={collapsedQuantity} />
        )}
        {breadcrumbs.map(({color, icon, ...crumb}, idx) => {
          const hasError = crumb.type === BreadcrumbType.ERROR;
          return (
            <React.Fragment key={idx}>
              <GridCellLeft hasError={hasError}>
                <Tooltip title={crumb.description}>
                  <BreadcrumbIcon icon={icon} color={color} />
                </Tooltip>
              </GridCellLeft>
              <GridCellCategory hasError={hasError}>
                <BreadcrumbCategory category={crumb?.category} />
              </GridCellCategory>
              <GridCell hasError={hasError}>
                <BreadcrumbData breadcrumb={crumb as Breadcrumb} />
              </GridCell>
              <GridCell hasError={hasError}>
                <BreadcrumbLevel level={crumb.level} />
              </GridCell>
              <GridCell hasError={hasError}>
                <BreadcrumbTime timestamp={crumb.timestamp} />
              </GridCell>
            </React.Fragment>
          );
        })}
      </Grid>
    );
  }
}

export default BreadcrumbsListBody;

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
