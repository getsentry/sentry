import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';
import {selectByValue} from 'sentry-test/select-new';

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
    const wrapper = mountWithTheme(
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

    expect(commitsMock).toHaveBeenCalled();
    await act(tick);
    wrapper.update();

    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
        label: expect.anything(),
      }),
    ]);

    selectByValue(wrapper, 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434', {
      selector: 'SelectAsyncControl[name="commit"]',
    });
    await act(tick);

    wrapper.find('form').simulate('submit');
    expect(onSelected).toHaveBeenCalledWith({
      inCommit: {
        commit: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
        repository: 'example/repo-name',
      },
    });
  });
});
