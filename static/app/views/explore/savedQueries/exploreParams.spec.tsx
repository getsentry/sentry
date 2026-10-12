import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import * as useDimensions from 'sentry/utils/useDimensions';

import {ExploreParams} from './exploreParams';

describe('ExploreParams', () => {
  it('should render', () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 900, height: 100});
    render(<ExploreParams query="test" visualizes={[]} groupBys={[]} />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should render overflow indicator when dimensions are small', () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 36, height: 100});
    render(<ExploreParams query="test" visualizes={[]} groupBys={[]} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should render regex filters as matches regex when regex operators are allowed', async () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 900, height: 100});
    render(
      <ExploreParams
        allowRegexOperators
        query="message://foo//"
        visualizes={[]}
        groupBys={[]}
      />
    );
    expect(
      await screen.findByText(textWithMarkupMatcher('message matches regex /foo/'))
    ).toBeInTheDocument();
  });

  it('should render regex filters as plain values when regex operators are not allowed', () => {
    jest.spyOn(useDimensions, 'useDimensions').mockReturnValue({width: 900, height: 100});
    render(<ExploreParams query="message://foo//" visualizes={[]} groupBys={[]} />);
    expect(
      screen.getByText(textWithMarkupMatcher('message is //foo//'))
    ).toBeInTheDocument();
  });
});
