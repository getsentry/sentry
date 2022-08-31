import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextData from 'sentry/components/contextData';

describe('ContextData', function () {
  describe('render()', function () {
    describe('strings', function () {
      it('should render urls w/ an additional <a> link', function () {
        const URL = 'https://example.org/foo/bar/';
        render(<ContextData data={URL} />);

        expect(screen.getByText(URL)).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', URL);
      });
    });
  });
});
