import {mount} from 'sentry-test/enzyme';

import TableChart from 'app/components/charts/tableChart';

describe('TableChart', function () {
  const renderer = jest.fn(() => null);

  beforeEach(function () {
    renderer.mockClear();
  });

  it('calculates row and column totals and passes to renderers', function () {
    const ERROR_TYPE_DATA = [
      ['TypeError', 50, 40, 30],
      ['SyntaxError', 40, 30, 20],
      ['NameError', 15, 15, 15],
      ['ZeroDivisionError', 20, 10, 0],
    ];
    mount(
      <TableChart
        title="Error Type"
        data={ERROR_TYPE_DATA}
        showRowTotal
        showColumnTotal
        widths={[null, 80, 80, 80, 100]}
      >
        {renderer}
      </TableChart>
    );

    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ERROR_TYPE_DATA,
        dataTotals: {
          columnTotals: [125, 95, 65],
          rowTotals: [120, 90, 45, 30, 285],
          total: 285,
        },
        dataMaybeWithTotals: [
          ['TypeError', 50, 40, 30],
          ['SyntaxError', 40, 30, 20],
          ['NameError', 15, 15, 15],
          ['ZeroDivisionError', 20, 10, 0],
          ['Total', 125, 95, 65, 285],
        ],
      })
    );
  });

  it('calculates totals with multiple non-data columns', function () {
    const ERROR_TYPE_DATA = [
      ['TypeError', 'Label', 50, 40, 30],
      ['SyntaxError', 'Label', 40, 30, 20],
      ['NameError', 'Label', 15, 15, 15],
      ['ZeroDivisionError', 'Label', 20, 10, 0],
    ];
    mount(
      <TableChart
        title="Error Type"
        data={ERROR_TYPE_DATA}
        showRowTotal
        showColumnTotal
        dataStartIndex={2}
        widths={[null, 80, 80, 80, 100]}
      >
        {renderer}
      </TableChart>
    );

    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ERROR_TYPE_DATA,
        dataTotals: {
          columnTotals: [125, 95, 65],
          rowTotals: [120, 90, 45, 30, 285],
          total: 285,
        },
        dataMaybeWithTotals: [
          ['TypeError', 'Label', 50, 40, 30],
          ['SyntaxError', 'Label', 40, 30, 20],
          ['NameError', 'Label', 15, 15, 15],
          ['ZeroDivisionError', 'Label', 20, 10, 0],
          ['Total', '', 125, 95, 65, 285],
        ],
      })
    );
  });

  it('renders percentage bar on correct rows', function () {
    const ERROR_TYPE_DATA = [
      ['TypeError', 50, 40, 30],
      ['SyntaxError', 40, 30, 20],
    ];
    const wrapper = mount(
      <TableChart
        title="Error Type"
        data={ERROR_TYPE_DATA}
        showRowTotal
        showColumnTotal
        shadeRowPercentage
        widths={[null, 80, 80, 80, 100]}
      />
    );

    expect(wrapper.find('TableChartRowBar')).toHaveLength(2);
    expect(wrapper.find('TableChartRow')).toHaveLength(3);
  });

  it('renders headers', function () {
    const headers = ['Foo', 'Bar', 'Baz'];
    mount(
      <TableChart
        title="Error Type"
        showRowTotal={false}
        headers={['Foo', 'Bar', 'Baz']}
        widths={[null, 100, 100]}
        renderRow={renderer}
      />
    );

    expect(renderer).toHaveBeenCalledTimes(1);
    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({
        items: headers,
      })
    );
  });

  it('renders headers with row total column', function () {
    mount(
      <TableChart
        title="Error Type"
        showRowTotal
        headers={['Foo', 'Bar', 'Baz']}
        widths={[null, 100, 100]}
        renderRow={renderer}
        rowTotalLabel="Row Total"
        rowTotalWidth={120}
      />
    );

    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({
        items: ['Foo', 'Bar', 'Baz', 'Row Total'],
      })
    );
  });

  it('renders correct cells', function () {
    const ERROR_TYPE_DATA = [
      ['TypeError', 50, 40, 30],
      ['SyntaxError', 40, 30, 20],
      ['NameError', 15, 15, 15],
      ['ZeroDivisionError', 20, 10, 0],
    ];
    const renderDataCell = jest.fn();
    const renderHeaderCell = jest.fn();
    const renderTableHeaderCell = jest.fn();
    mount(
      <TableChart
        title="Error Type"
        showRowTotal
        showColumnTotal
        data={ERROR_TYPE_DATA}
        headers={['', '', '', '']}
        widths={[null, 100, 100]}
        rowTotalLabel="Row Total"
        columnTotalLabel="Column Total"
        rowTotalWidth={111}
        renderDataCell={renderDataCell}
        renderHeaderCell={renderHeaderCell}
        renderTableHeaderCell={renderTableHeaderCell}
      />
    );

    // table headers === Number of data columns + total column
    expect(renderTableHeaderCell).toHaveBeenCalledTimes(5);
    expect(renderTableHeaderCell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 111,
        value: 'Row Total',
      })
    );

    // header cells is the number of data rows + total row (e.g. no table header row)
    expect(renderHeaderCell).toHaveBeenCalledTimes(5);
    expect(renderHeaderCell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: null,
        value: 'Column Total',
      })
    );

    // data cells is the table without table header row and without header cells (includes totals)
    expect(renderDataCell).toHaveBeenCalledTimes(20);
    [
      50,
      40,
      30,
      120,
      40,
      30,
      20,
      90,
      15,
      15,
      15,
      45,
      20,
      10,
      0,
      30,
      125,
      95,
      65,
      285,
    ].forEach((value, i) =>
      expect(renderDataCell).toHaveBeenNthCalledWith(
        i + 1,
        expect.objectContaining({value})
      )
    );
    expect(renderDataCell).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 111,
      })
    );
  });
});
