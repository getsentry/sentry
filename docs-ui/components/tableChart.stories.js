import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {number, text, boolean, array} from '@storybook/addon-knobs';

import TableChart from 'app/components/charts/tableChart';

export default {
  title: 'Charts/TableChart',
};

export const _TableChart = withInfo(
  'A simple table that can calculate totals and relative share as a bar inside of a row'
)(() => {
  const ERROR_TYPE_DATA = [
    ['TypeError', 50, 40, 30],
    ['SyntaxError', 40, 30, 20],
    ['NameError', 15, 15, 15],
    ['ZeroDivisionError', 20, 10, 0],
  ];

  return (
    <TableChart
      data={ERROR_TYPE_DATA}
      dataStartIndex={number('Data Start Index', 1)}
      showRowTotal={boolean('Show Row Total', true)}
      showColumnTotal={boolean('Show Column Total', true)}
      shadeRowPercentage={boolean('Shade Row %', true)}
      headers={array('Headers', [
        text('Column 1', 'Exception Type'),
        text('Column 2', 'Project 1'),
        text('Column 3', 'Project 2'),
        text('Column 4', 'Project 3'),
      ])}
      widths={array('Widths', [
        number('Column 1', null),
        number('Column 2', 100),
        number('Column 3', 100),
        number('Column 4', 100),
      ])}
      rowTotalLabel={text('Row Total Label', 'Row Total')}
      rowTotalWidth={number('Row Total Column Width', 120)}
    />
  );
});

_TableChart.story = {
  name: 'TableChart',
};
