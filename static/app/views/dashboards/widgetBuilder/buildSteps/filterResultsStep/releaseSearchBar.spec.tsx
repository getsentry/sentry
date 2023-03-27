import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ReleaseSearchBar} from './releaseSearchBar';

describe('Release Search Bar', function () {
  const {organization} = initializeOrg();
  const pageFilters = {
    datetime: {
      period: '14d',
      utc: null,
      start: null,
      end: null,
    },
    environments: [],
    projects: [],
  };

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  it('does not allow search conditions with keys not equal to release, project, or environment', async function () {
    render(
      <ReleaseSearchBar
        onClose={undefined}
        organization={organization}
        pageFilters={pageFilters}
        widgetQuery={{
          aggregates: [],
          columns: [],
          conditions: '',
          name: '',
          orderby: '',
          fieldAliases: undefined,
          fields: undefined,
        }}
      />
    );
    const textbox = screen.getByRole('textbox');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'test-key:10 ');
    await userEvent.keyboard('{arrowleft}');

    expect(
      screen.getByText('Invalid key. "test-key" is not a supported search key.')
    ).toBeInTheDocument();
  });
});
