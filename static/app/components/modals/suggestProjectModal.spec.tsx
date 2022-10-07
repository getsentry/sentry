import {render} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import SuggestProjectModal from 'sentry/components/modals/suggestProjectModal';

describe('SuggestProjectModal', function () {
  it('renders', function () {
    const {container} = render(<GlobalModal />);

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
