import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StructuredEventData from 'sentry/components/structuredEventData';

describe('ContextData', function () {
  describe('strings', function () {
    it('should render urls w/ an additional <a> link', function () {
      const URL = 'https://example.org/foo/bar/';
      render(<StructuredEventData data={URL} />);

      expect(screen.getByText(URL)).toBeInTheDocument();
      expect(screen.getByRole('link')).toHaveAttribute('href', URL);
    });
  });

  describe('boolean', function () {
    it('should render boolean values correctly', function () {
      render(<StructuredEventData data={false} />);
      expect(
        within(screen.getByTestId('value-boolean')).getByText('false')
      ).toBeInTheDocument();
    });

    it('can customize how booleans are rendered', function () {
      render(
        <StructuredEventData
          data="bool_value_input"
          config={{
            isNull: value => value === 'bool_value_input',
            renderNull: () => 'bool_value_output',
          }}
        />
      );
      expect(
        within(screen.getByTestId('value-null')).getByText('bool_value_output')
      ).toBeInTheDocument();
    });
  });

  describe('null', function () {
    it('should render null values correctly', function () {
      render(<StructuredEventData data={null} />);
      expect(
        within(screen.getByTestId('value-null')).getByText('null')
      ).toBeInTheDocument();
    });

    it('can customize how nulls are rendered', function () {
      render(
        <StructuredEventData
          data="null_value_input"
          config={{
            isNull: value => value === 'null_value_input',
            renderNull: () => 'null_value_output',
          }}
        />
      );
      expect(
        within(screen.getByTestId('value-null')).getByText('null_value_output')
      ).toBeInTheDocument();
    });
  });

  describe('collpasible values', function () {
    it('auto-collapses objects/arrays with more than 5 items', async function () {
      render(
        <StructuredEventData
          data={{
            one: {one_child: 'one_child_value'},
            two: {
              two_1: 'two_child_value',
              two_2: 2,
              two_3: 3,
              two_4: 4,
              two_5: 5,
              two_6: 6,
            },
          }}
        />
      );

      expect(screen.getByText('one_child_value')).toBeInTheDocument();
      expect(screen.queryByText('two_child_value')).not.toBeInTheDocument();

      // Click the "6 items" button to expand the object
      await userEvent.click(screen.getByRole('button', {name: '6 items'}));
      expect(screen.getByText('two_child_value')).toBeInTheDocument();
    });
  });

  it('auto-collapses objects/arrays after max depth', async function () {
    render(<StructuredEventData data={[1, [2, 3]]} maxDefaultDepth={1} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();

    // Click the "2 items" button to expand the array
    await userEvent.click(screen.getByRole('button', {name: '2 items'}));
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
