import {render, screen, within} from 'sentry-test/reactTestingLibrary';

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
});
