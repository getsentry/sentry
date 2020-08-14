import React from 'react';

type Props = {
  allRowsSelected: boolean;
  allRowsCount: number;
  selectedRowsCount: number;
  onCancelAllRows: () => void;
  onSelectAllRows: () => void;
};

function TableNotice({
  allRowsSelected,
  allRowsCount,
  selectedRowsCount,
  onCancelAllRows,
  onSelectAllRows,
}: Props) {
  if (allRowsSelected) {
    return (
      <div>
        All {selectedRowsCount} items are selected.
        <button onClick={onCancelAllRows}>Cancel selection</button>
      </div>
    );
  }

  if (selectedRowsCount > 0) {
    return (
      <div>
        {selectedRowsCount} items are selected
        <button onClick={onSelectAllRows}>Select all {allRowsCount} items</button>
        <button onClick={onCancelAllRows}>Cancel selection</button>
      </div>
    );
  }

  return null;
}

export default TableNotice;
