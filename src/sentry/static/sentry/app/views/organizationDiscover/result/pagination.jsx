import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import Button from 'app/components/button';

export default class Pagination extends React.Component {
  static propTypes = {
    getNextPage: PropTypes.func.isRequired,
    getPreviousPage: PropTypes.func.isRequired,
    previous: PropTypes.object,
    next: PropTypes.object,
  };


  render() {
    const {getPreviousPage, getNextPage, previous, next} = this.props;

    return (
      <PaginationButtons className="btn-group">
        <Button
          className="btn"
          disabled={previous && !previous.results}
          size="xsmall"
          icon="icon-chevron-left"
          onClick={getPreviousPage}
        />
        <Button
          className="btn"
          disabled={next && !next.results}
          size="xsmall"
          icon="icon-chevron-right"
          onClick={getNextPage}
        />
      </PaginationButtons>
    );
  }
}

const PaginationButtons = styled(Flex)`
  justify-content: flex-end;
`;
