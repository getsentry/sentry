import {render} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';

describe('useNavigate', () => {
  it('returns the navigate function', () => {
    let navigate: ReturnType<typeof useNavigate> | undefined;

    function HomePage() {
      // oxlint-disable-next-line react/globals -- Test captures the hook result in an outer variable to assert on it.
      navigate = useNavigate();
      return null;
    }

    render(<HomePage />);

    expect(typeof navigate).toBe('function');
  });
});
