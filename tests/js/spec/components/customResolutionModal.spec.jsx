import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import CustomResolutionModal from 'sentry/components/customResolutionModal';

describe('CustomResolutionModal', function () {
  let releasesMock;
  beforeEach(function () {
    releasesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [TestStubs.Release()],
    });
  });

  it('can select a version', async function () {
    const onSelected = jest.fn();
    const wrapper = mountWithTheme(
      <CustomResolutionModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        orgSlug="org-slug"
        projectSlug="project-slug"
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );

    expect(releasesMock).toHaveBeenCalled();
    await tick();
    wrapper.update();

    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'sentry-android-shop@1.2.0',
        label: expect.anything(),
      }),
    ]);

    selectByValue(wrapper, 'sentry-android-shop@1.2.0', {
      selector: 'SelectAsyncControl[name="version"]',
    });

    wrapper.find('form').simulate('submit');
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });
});
