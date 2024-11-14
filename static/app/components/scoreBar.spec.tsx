import {render} from 'sentry-test/reactTestingLibrary';

import ScoreBar from 'sentry/components/scoreBar';

describe('ScoreBar', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    render(<ScoreBar size={60} thickness={2} score={3} />);
  });

  it('renders vertically', function () {
    render(<ScoreBar size={60} thickness={2} vertical score={2} />);
  });

  it('renders with score = 0', function () {
    render(<ScoreBar size={60} thickness={2} score={0} />);
  });

  it('renders with score > max score', function () {
    render(<ScoreBar size={60} thickness={2} score={10} />);
  });

  it('renders with < 0 score', function () {
    render(<ScoreBar size={60} thickness={2} score={-2} />);
  });

  it('has custom palette', function () {
    render(
      <ScoreBar
        vertical
        size={60}
        thickness={2}
        score={7}
        palette={['white', 'red', 'red', 'pink', 'pink', 'purple', 'purple', 'black']}
      />
    );
  });
});
