import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
