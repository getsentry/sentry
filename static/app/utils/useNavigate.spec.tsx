import {render} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';

describe('useNavigate', () => {
  it('returns the navigate function', () => {
    let navigate: ReturnType<typeof useNavigate> | undefined = undefined;

    function HomePage() {
      navigate = useNavigate();
      return null;
    }

    render(<HomePage />);

    expect(typeof navigate).toBe('function');
  });
});
