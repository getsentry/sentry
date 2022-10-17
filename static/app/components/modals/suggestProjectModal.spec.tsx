import {renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import SuggestProjectModal from 'sentry/components/modals/suggestProjectModal';

describe('SuggestProjectModal', function () {
  it('renders', function () {
    const {container} = renderGlobalModal();

    openModal(modalProps => (
      <SuggestProjectModal
        {...modalProps}
        organization={TestStubs.Organization()}
        matchedUserAgentString="okhttp/"
      />
    ));

    expect(container).toSnapshot();
  });
});
