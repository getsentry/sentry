import {render} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line boundaries/dependencies
import {TextArea} from './textarea';

describe('TextArea', () => {
  it('should render', () => {
    render(<TextArea />);
  });
});
