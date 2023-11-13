import {Organization} from 'sentry-fixture/organization';

import {act, renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import SuggestProjectModal from 'sentry/components/modals/suggestProjectModal';

describe('SuggestProjectModal', function () {
  it('renders', function () {
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <SuggestProjectModal
          {...modalProps}
          organization={Organization()}
          matchedUserAgentString="okhttp/"
        />
      ))
    );
  });
});
