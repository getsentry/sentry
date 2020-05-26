import React from 'react';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

import {Collapsed} from './collapsed';
import {Data} from './data/data';
import {Category} from './category';
import {Time} from './time';
import {Icon} from './icon';
import {Level} from './level';
import {Grid, GridCell, GridCellLeft} from './styles';
import {Breadcrumb, BreadcrumbDetails, BreadcrumbType} from './types';

type Breadcrumbs = Array<Breadcrumb & BreadcrumbDetails & {id: number}>;

type Props = {
  breadcrumbs: Breadcrumbs;
  collapsedQuantity: number;
  onToggleCollapse: () => void;
  event: Event;
  orgId: string | null;
};

type State = {
  breadCrumbListHeight?: React.CSSProperties['maxHeight'];
};

class ListBody extends React.Component<Props, State> {
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
    const {collapsedQuantity, onToggleCollapse, breadcrumbs, event, orgId} = this.props;
    const {breadCrumbListHeight} = this.state;

    return (
      <Grid maxHeight={breadCrumbListHeight} ref={this.listRef}>
        {collapsedQuantity > 0 && (
          <Collapsed onClick={onToggleCollapse} quantity={collapsedQuantity} />
        )}
        {breadcrumbs.map(({color, icon, ...crumb}, idx) => {
          const hasError = crumb.type === BreadcrumbType.ERROR;
          const isLastItem = breadcrumbs.length - 1 === idx;
          return (
            <React.Fragment key={idx}>
              <GridCellLeft hasError={hasError} isLastItem={isLastItem}>
                <Tooltip title={crumb.description}>
                  <Icon icon={icon} color={color} />
                </Tooltip>
              </GridCellLeft>
              <GridCellCategory hasError={hasError} isLastItem={isLastItem}>
                <Category category={crumb?.category} />
              </GridCellCategory>
              <GridCell hasError={hasError} isLastItem={isLastItem}>
                <Data event={event} orgId={orgId} breadcrumb={crumb as Breadcrumb} />
              </GridCell>
              <GridCell hasError={hasError} isLastItem={isLastItem}>
                <Level level={crumb.level} />
              </GridCell>
              <GridCell hasError={hasError} isLastItem={isLastItem}>
                <Time timestamp={crumb.timestamp} />
              </GridCell>
            </React.Fragment>
          );
        })}
      </Grid>
    );
  }
}

export {ListBody};

const GridCellCategory = styled(GridCell)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-left: ${space(1)};
  }
`;
