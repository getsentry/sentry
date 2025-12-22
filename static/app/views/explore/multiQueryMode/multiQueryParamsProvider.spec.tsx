import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MultiQueryParamsProvider} from 'sentry/views/explore/multiQueryMode/multiQueryParamsProvider';
import {useQueryParams} from 'sentry/views/explore/queryParams/context';

describe('MultiQueryParamsProvider', () => {
  it('provides context without throwing errors', () => {
    function TestComponent() {
      const queryParams = useQueryParams();
      return <div>{queryParams.query}</div>;
    }

    render(
      <MultiQueryParamsProvider>
        <TestComponent />
      </MultiQueryParamsProvider>
    );

    // Should render empty query without errors
    expect(screen.getByText('')).toBeInTheDocument();
  });

  it('provides crossEvents as undefined', () => {
    function TestComponent() {
      const queryParams = useQueryParams();
      return (
        <div>
          {queryParams.crossEvents === undefined ? 'undefined' : 'has-cross-events'}
        </div>
      );
    }

    render(
      <MultiQueryParamsProvider>
        <TestComponent />
      </MultiQueryParamsProvider>
    );

    expect(screen.getByText('undefined')).toBeInTheDocument();
  });
});
