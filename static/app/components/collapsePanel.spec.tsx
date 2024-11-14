import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CollapsePanel from 'sentry/components/collapsePanel';

describe('CollapsePanel', () => {
  it('should expand on click', async () => {
    render(
      <CollapsePanel items={10}>
        {({isExpanded, showMoreButton}) => (
          <Fragment>
            <div>expanded: {isExpanded.toString()}</div> {showMoreButton}
          </Fragment>
        )}
      </CollapsePanel>
    );

    expect(screen.getByText('expanded: false')).toBeInTheDocument();

    expect(screen.getByTestId('collapse-show-more')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('collapse-show-more'));

    expect(screen.getByText('expanded: true')).toBeInTheDocument();
  });
});
