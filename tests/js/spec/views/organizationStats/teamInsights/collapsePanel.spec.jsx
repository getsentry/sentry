import {Fragment} from 'react';

import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CollapsePanel from 'sentry/views/organizationStats/teamInsights/collapsePanel';

describe('CollapsePanel', () => {
  it('should expand on click', () => {
    mountWithTheme(
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
    userEvent.click(screen.getByTestId('collapse-show-more'));

    expect(screen.getByText('expanded: true')).toBeInTheDocument();
  });
});
