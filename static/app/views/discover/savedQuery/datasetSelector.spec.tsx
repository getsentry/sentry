import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DatasetSelector} from 'sentry/views/discover/savedQuery/datasetSelector';

describe('Discover DatasetSelector', function () {
  const {router} = initializeOrg({
    organization: {features: ['performance-view']},
  });

  it('renders selector and options', async function () {
    render(<DatasetSelector isHomepage={false} savedQuery={undefined} />, {
      router,
    });
    await userEvent.click(screen.getByText('Dataset'));
    const menuOptions = await screen.findAllByRole('option');
    expect(menuOptions.map(e => e.textContent)).toEqual(['Errors', 'Transactions']);
  });

  it('pushes new event view', async function () {
    render(<DatasetSelector isHomepage={false} savedQuery={undefined} />, {
      router,
    });
    await userEvent.click(screen.getByText('Dataset'));
    await userEvent.click(screen.getByRole('option', {name: 'Transactions'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          project: [],
          field: ['title', 'project', 'user.display', 'timestamp'],
          query: 'event.type:transaction',
          queryDataset: 'transaction-like',
        }),
      })
    );
  });
});
