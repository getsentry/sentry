import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import StructuredEventData from 'sentry/components/structuredEventData';

describe('StructuredEventData', function () {
  describe('strings', function () {
    it('should render urls w/ an additional <a> link', async function () {
      const URL = 'https://example.org/foo/bar/';
      renderGlobalModal();
      render(<StructuredEventData data={URL} />);

      expect(screen.getByText(URL)).toBeInTheDocument();
      const linkHint = screen.getByRole('link');
      await userEvent.click(linkHint);
      expect(screen.getByTestId('external-link-warning')).toBeInTheDocument();
    });

    it('should not render urls if meta is present', function () {
      const URL = 'https://example.org/foo/bar/super/long...';
      renderGlobalModal();
      const meta = {
        '': {
          err: [
            [
              'invalid_data',
              {
                reason: 'value too long',
              },
            ],
          ],
        },
      };
      render(<StructuredEventData data={URL} meta={meta} />);
      expect(screen.getByText(URL)).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should render multiline strings correctly', function () {
      const data = 'foo\nbar\nbaz';
      render(<StructuredEventData data={data} />);

      expect(screen.getByTestId('value-multiline-string')).toHaveTextContent(
        'foo bar baz'
      );
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

  describe('initial expanded state', () => {
    const data = {
      foo: 'bar',
      'the_real_world?': {
        the_city: {
          the_hotel: {
            the_fortress: 'a pinwheel',
          },
        },
      },
      arr_en: ['one', 'two', 'three', 'four', 'five'],
      arr_de: ['eins', 'zwei', 'drei', 'vier', 'funf', 'sechs'],
    };

    it('auto-expands two levels by default', () => {
      render(<StructuredEventData data={data} />);

      // String value, visible
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();

      // Deep object, expanded 2 levels
      expect(screen.getByText('the_real_world?')).toBeInTheDocument();
      expect(screen.getByText('the_city')).toBeInTheDocument();
      expect(screen.queryByText('the_hotel')).not.toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();

      // object with 5 items, expanded
      expect(screen.getByText('arr_en')).toBeInTheDocument();
      expect(screen.getByText('one')).toBeInTheDocument();

      // object with 6 items, collapsed
      expect(screen.getByText('arr_de')).toBeInTheDocument();
      expect(screen.queryByText('eins')).not.toBeInTheDocument();
      expect(screen.getByText('6 items')).toBeInTheDocument();
    });

    it('auto-expands whatever is listed by `initialExpandedPaths`', () => {
      render(
        <StructuredEventData
          data={data}
          initialExpandedPaths={[
            '$',
            '$.the_real_world?',
            '$.the_real_world?.the_city',
            '$.the_real_world?.the_city.the_hotel',
            '$.the_real_world?.the_city.the_hotel.the_fortress',
          ]}
        />
      );

      // because '$' is expanded:
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();

      // each of these are explicitly expanded
      expect(screen.getByText('the_real_world?')).toBeInTheDocument();
      expect(screen.getByText('the_city')).toBeInTheDocument();
      expect(screen.getByText('the_hotel')).toBeInTheDocument();
      expect(screen.getByText('the_fortress')).toBeInTheDocument();
      expect(screen.getByText('a pinwheel')).toBeInTheDocument();

      // Not expanded, but their counts are visible
      expect(screen.getByText('arr_en')).toBeInTheDocument();
      expect(screen.queryByText('one')).not.toBeInTheDocument();
      expect(screen.getByText('5 items')).toBeInTheDocument();
      expect(screen.getByText('arr_de')).toBeInTheDocument();
      expect(screen.queryByText('eins')).not.toBeInTheDocument();
      expect(screen.getByText('6 items')).toBeInTheDocument();
    });

    it('auto-expands nothing when forceDefaultExpand=false', () => {
      render(<StructuredEventData data={data} forceDefaultExpand={false} />);

      expect(screen.getByText('4 items')).toBeInTheDocument();
    });

    it('auto-expands at least one level when forceDefaultExpand=true, even if maxDefaultDepth=0', () => {
      render(<StructuredEventData data={data} forceDefaultExpand maxDefaultDepth={0} />);

      expect(screen.queryByText('4 items')).not.toBeInTheDocument();

      // because '$' is expanded:
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();

      expect(screen.getByText('the_real_world?')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
      expect(screen.getByText('arr_en')).toBeInTheDocument();
      expect(screen.getByText('5 items')).toBeInTheDocument();
      expect(screen.getByText('arr_de')).toBeInTheDocument();
      expect(screen.getByText('6 items')).toBeInTheDocument();
    });

    it('auto-expands N levels when forceDefaultExpand=undefined maxDefaultDepth=N', () => {
      render(<StructuredEventData data={data} maxDefaultDepth={2} />);

      // String value, visible
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();

      // Deep object, expanded 2 levels
      expect(screen.getByText('the_real_world?')).toBeInTheDocument();
      expect(screen.getByText('the_city')).toBeInTheDocument();
      expect(screen.queryByText('the_hotel')).not.toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();

      // object with 5 items, expanded
      expect(screen.getByText('arr_en')).toBeInTheDocument();
      expect(screen.getByText('one')).toBeInTheDocument();

      // object with 6 items, collapsed
      expect(screen.getByText('arr_de')).toBeInTheDocument();
      expect(screen.queryByText('eins')).not.toBeInTheDocument();
      expect(screen.getByText('6 items')).toBeInTheDocument();
    });

    it('invokes a callback whenever something is toggled open/closed for tracking', async () => {
      const callback = jest.fn();
      render(<StructuredEventData data={data} onToggleExpand={callback} />);

      expect(screen.queryByText('eins')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: '6 items'}));

      expect(screen.getByText('eins')).toBeInTheDocument();
      expect(callback).toHaveBeenCalledWith(
        ['$', '$.the_real_world?', '$.arr_en', '$.arr_de'],
        '$.arr_de',
        'expanded'
      );

      const buttons = screen.getAllByRole('button', {name: 'Collapse'});
      const rootButton = buttons.at(0);
      await userEvent.click(rootButton!);

      expect(callback).toHaveBeenCalledWith(
        ['$.the_real_world?', '$.arr_en', '$.arr_de'],
        '$',
        'collapsed'
      );

      await userEvent.click(rootButton!);

      expect(callback).toHaveBeenCalledWith(
        ['$.the_real_world?', '$.arr_en', '$.arr_de', '$'],
        '$',
        'expanded'
      );
    });
  });
});
