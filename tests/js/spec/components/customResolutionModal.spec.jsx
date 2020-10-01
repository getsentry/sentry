import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CustomResolutionModal from 'app/components/customResolutionModal';

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
        orgId="org-slug"
        projectId="project-slug"
        onCanceled={() => false}
        onSelected={onSelected}
        show
      />,
      TestStubs.routerContext()
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

    wrapper.find('input[id="version"]').simulate('change', {target: {value: '1.2.0'}});

    await tick();
    wrapper.update();

    wrapper.find('input[id="version"]').simulate('keyDown', {keyCode: 13});

    expect(wrapper.find('SelectControl').prop('value')).toEqual({
      value: 'sentry-android-shop@1.2.0',
      label: expect.anything(),
    });
    wrapper.find('form').simulate('submit');
    expect(onSelected).toHaveBeenCalledWith({
      inRelease: 'sentry-android-shop@1.2.0',
    });
  });
});
