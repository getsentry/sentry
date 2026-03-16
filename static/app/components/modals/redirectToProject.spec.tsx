import {act, renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {RedirectToProjectModal} from 'sentry/components/modals/redirectToProject';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

jest.mock('sentry/utils/recreateRoute', () => jest.fn(() => '/org-slug/new-slug/'));

describe('RedirectToProjectModal', () => {
  it('has timer to redirect to new slug after mounting', () => {
    jest.useFakeTimers();

    renderGlobalModal();

    act(() =>
      openModal(modalProps => <RedirectToProjectModal {...modalProps} slug="new-slug" />)
    );

    act(() => jest.advanceTimersByTime(4900));
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(200));
    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('/org-slug/new-slug/');
  });
});
