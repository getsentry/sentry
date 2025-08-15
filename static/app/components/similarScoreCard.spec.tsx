import {render} from 'sentry-test/reactTestingLibrary';

import SimilarScoreCard from 'sentry/components/similarScoreCard';

describe('SimilarScoreCard', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('renders', () => {
    const {container} = render(<SimilarScoreCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with score list', () => {
    render(
      <SimilarScoreCard
        scoreList={[
          ['exception:message:character-shingles', null],
          ['exception:stacktrace:application-chunks', 0.8],
          ['exception:stacktrace:pairs', 1],
          ['message:message:character-shingles', 0.5],
          ['unknown:foo:bar', 0.5],
        ]}
      />
    );
  });
});
