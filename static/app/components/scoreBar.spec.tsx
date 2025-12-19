import {render} from 'sentry-test/reactTestingLibrary';

import ScoreBar from 'sentry/components/scoreBar';

describe('ScoreBar', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('renders', () => {
    render(<ScoreBar size={60} thickness={2} score={3} />);
  });

  it('renders vertically', () => {
    render(<ScoreBar size={60} thickness={2} vertical score={2} />);
  });

  it('renders with score = 0', () => {
    render(<ScoreBar size={60} thickness={2} score={0} />);
  });

  it('renders with score > max score', () => {
    render(<ScoreBar size={60} thickness={2} score={10} />);
  });

  it('renders with < 0 score', () => {
    render(<ScoreBar size={60} thickness={2} score={-2} />);
  });

  it('has custom palette', () => {
    render(
      <ScoreBar
        vertical
        size={60}
        thickness={2}
        score={7}
        palette={['red', 'red', 'pink', 'pink', 'purple', 'purple']}
      />
    );
  });
});
