import {render} from 'sentry-test/reactTestingLibrary';

import ScoreBar from 'sentry/components/scoreBar';

describe('ScoreBar', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const {container} = render(<ScoreBar size={60} thickness={2} score={3} />);
    expect(container).toSnapshot();
  });

  it('renders vertically', function () {
    const {container} = render(<ScoreBar size={60} thickness={2} vertical score={2} />);
    expect(container).toSnapshot();
  });

  it('renders with score = 0', function () {
    const {container} = render(<ScoreBar size={60} thickness={2} score={0} />);
    expect(container).toSnapshot();
  });

  it('renders with score > max score', function () {
    const {container} = render(<ScoreBar size={60} thickness={2} score={10} />);
    expect(container).toSnapshot();
  });

  it('renders with < 0 score', function () {
    const {container} = render(<ScoreBar size={60} thickness={2} score={-2} />);
    expect(container).toSnapshot();
  });

  it('has custom palette', function () {
    const {container} = render(
      <ScoreBar
        vertical
        size={60}
        thickness={2}
        score={7}
        palette={['white', 'red', 'red', 'pink', 'pink', 'purple', 'purple', 'black']}
      />
    );
    expect(container).toSnapshot();
  });
});
