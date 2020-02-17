import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';

type PaginationProps = {
  getNextPage: () => void;
  getPreviousPage: () => void;
  previous?: string | null;
  next?: string | null;
};

export default class Pagination extends React.Component<PaginationProps> {
  render() {
    const {getPreviousPage, getNextPage, previous, next} = this.props;

    return (
      <PaginationButtons className="btn-group">
        <Button
          className="btn"
          disabled={!previous}
          size="xsmall"
          icon="icon-chevron-left"
          onClick={getPreviousPage}
        />
        <Button
          className="btn"
          disabled={!next}
          size="xsmall"
          icon="icon-chevron-right"
          onClick={getNextPage}
        />
      </PaginationButtons>
    );
  }
}

const PaginationButtons = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
