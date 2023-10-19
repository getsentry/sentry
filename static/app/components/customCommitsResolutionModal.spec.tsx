import selectEvent from 'react-select-event';
import styled from '@emotion/styled';
import {Commit} from 'sentry-fixture/commit';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import {makeCloseButton} from 'sentry/components/globalModal/components';

describe('CustomCommitsResolutionModal', function () {
  let commitsMock;
  beforeEach(function () {
    commitsMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/commits/',
      body: [Commit()],
    });
  });

  it('can select a commit', async function () {
    const onSelected = jest.fn();

    const wrapper = styled(p => p.children);
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
});
