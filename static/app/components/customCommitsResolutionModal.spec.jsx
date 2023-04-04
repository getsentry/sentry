import selectEvent from 'react-select-event';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';

describe('CustomCommitsResolutionModal', function () {
  let commitsMock;
  beforeEach(function () {
    commitsMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/commits/',
      body: [TestStubs.Commit()],
    });
  });

  it('can select a commit', async function () {
    const onSelected = jest.fn();
    render(
      <CustomCommitsResolutionModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        orgSlug="org-slug"
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    await act(tick);

    expect(commitsMock).toHaveBeenCalled();
    await selectEvent.select(screen.getByText('e.g. d86b832'), 'f7f395d14b2f');
    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(onSelected).toHaveBeenCalledWith({
      inCommit: {
        commit: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
        repository: 'example/repo-name',
      },
    });
  });
});
