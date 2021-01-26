import React from 'react';

import TableChart from 'app/components/charts/tableChart';

export default {
  title: 'DataVisualization/Charts/TableChart',
  componet: TableChart,
};

export const _TableChart = ({...args}) => {
  const ERROR_TYPE_DATA = [
    ['TypeError', 50, 40, 30],
    ['SyntaxError', 40, 30, 20],
    ['NameError', 15, 15, 15],
    ['ZeroDivisionError', 20, 10, 0],
  ];

  return <TableChart data={ERROR_TYPE_DATA} {...args} />;
};

_TableChart.storyName = 'TableChart';
_TableChart.args = {
  dataStartIndex: 1,
  showRowTotal: true,
  showColumnTotal: true,
  shadeRowPercentage: true,
  rowTotalLabel: 'Row Total',
  rowTotalWidth: 120,
  widths: [null, 100, 100, 100],
  headers: ['Exception Type', 'Project 1', 'Project 2', 'Project 3'],
};
_TableChart.parameters = {
  docs: {
    description: {
      story:
        'A simple table that can calculate totals and relative share as a bar inside of a row',
    },
  },
};
