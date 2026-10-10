import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerRepoTableHeader} from 'sentry/components/seer/repoTable/seerRepoTableHeader';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';

describe('SeerRepoTableHeader', () => {
  const repository: RepositoryWithSettings = {
    ...RepositoryFixture({id: '1'}),
    settings: {
      enabledCodeReview: true,
      codeReviewTriggers: ['on_ready_for_review'],
    },
  };

  it.each([
    {trigger: 'Code Review', option: 'Enable'},
    {trigger: 'Triggers', option: 'On New Commit'},
  ])(
    'positions the $trigger menu with the fixed strategy so the header cell cannot clip it',
    async ({trigger, option}) => {
      render(
        <ListItemCheckboxProvider
          hits={1}
          knownIds={[repository.id]}
          endpointOptions={undefined}
        >
          <SimpleTable>
            <SeerRepoTableHeader
              gridColumns="48px 1fr 138px 150px"
              isFetchingNextPage={false}
              isPending={false}
              mutateRepositorySettings={jest.fn()}
              onSortClick={jest.fn()}
              repositories={[repository]}
              sort={{field: 'name', kind: 'asc'}}
            />
          </SimpleTable>
        </ListItemCheckboxProvider>,
        {organization: OrganizationFixture({access: ['org:write']})}
      );

      await userEvent.click(screen.getByRole('checkbox'));
      await userEvent.click(screen.getByRole('button', {name: trigger}));

      const menu = await screen.findByRole('listbox');
      expect(screen.getByRole('option', {name: option})).toBeInTheDocument();
      expect(menu.closest('[data-overlay]')?.parentElement).toHaveStyle({
        position: 'fixed',
      });
    }
  );
});
