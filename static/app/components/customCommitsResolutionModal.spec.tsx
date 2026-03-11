import styled from '@emotion/styled';
import {CommitFixture} from 'sentry-fixture/commit';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import {makeCloseButton} from 'sentry/components/globalModal/components';

describe('CustomCommitsResolutionModal', () => {
  let commitsMock: any;
  beforeEach(() => {
    commitsMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/commits/',
      body: [CommitFixture()],
    });
  });

  it('can select a commit', async () => {
    const onSelected = jest.fn();

    const wrapper = styled((p: any) => p.children);
    render(
      <CustomCommitsResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        orgSlug="org-slug"
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    await waitFor(() => {
      expect(commitsMock).toHaveBeenCalled();
    });

    await selectEvent.select(screen.getByText('e.g. d86b832'), 'f7f395d14b2f');
    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        inCommit: {
          commit: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
          repository: 'example/repo-name',
        },
      })
    );
  });

  it('can filter commits via typeahead and select a filtered result', async () => {
    const onSelected = jest.fn();
    const filteredCommit = CommitFixture({
      id: 'abc123filtered',
      message: 'Filtered commit message',
    });

    // Mock for filtered search
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/commits/',
      body: [filteredCommit],
      match: [MockApiClient.matchQuery({query: 'abc'})],
    });

    const wrapper = styled((p: any) => p.children);
    render(
      <CustomCommitsResolutionModal
        Header={p => <span>{p.children}</span>}
        Body={wrapper()}
        Footer={wrapper()}
        orgSlug="org-slug"
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => null)}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(commitsMock).toHaveBeenCalled();
    });

    // Type in the search box to filter
    const selectInput = screen.getByRole('textbox');
    await userEvent.type(selectInput, 'abc');

    // Wait for filtered results to appear and select the commit
    await selectEvent.select(screen.getByRole('textbox'), 'abc123filtered');

    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        inCommit: {
          commit: 'abc123filtered',
          repository: 'example/repo-name',
        },
      })
    );
  });
});
