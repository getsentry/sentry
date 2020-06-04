import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import ListHeader from './listHeader';
import ListBody from './listBody';
import {aroundContentStyle} from './styles';

type Props = {
  forwardRef: React.RefObject<HTMLDivElement>;
} & Omit<React.ComponentProps<typeof ListBody>, 'relativeTime'>;

type State = {
  displayRelativeTime: boolean;
};

class List extends React.PureComponent<Props, State> {
  state: State = {
    displayRelativeTime: false,
  };

  handleSwicthTimeFormat = () => {
    this.setState(prevState => ({
      displayRelativeTime: !prevState.displayRelativeTime,
    }));
  };

  render() {
    const {forwardRef, event, orgId, breadcrumbs} = this.props;
    const {displayRelativeTime} = this.state;

    return (
      <Grid ref={forwardRef}>
        <ListHeader
          onSwitchTimeFormat={this.handleSwicthTimeFormat}
          displayRelativeTime={!!displayRelativeTime}
        />
        <ListBody
          event={event}
          orgId={orgId}
          breadcrumbs={breadcrumbs}
          relativeTime={breadcrumbs[0]?.timestamp}
          displayRelativeTime={!!displayRelativeTime}
        />
      </Grid>
    );
  }
}

export default List;

const Grid = styled('div')`
  max-height: 500px;
  overflow-y: auto;
  display: grid;
  > *:nth-last-child(5):before {
    bottom: calc(100% - ${space(1)});
  }
  grid-template-columns: max-content minmax(55px, 1fr) 6fr max-content 65px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: max-content minmax(132px, 1fr) 6fr max-content max-content;
  }
  ${aroundContentStyle}
`;
