import {render} from 'sentry-test/reactTestingLibrary';

import SuggestProjectModal from 'sentry/components/modals/suggestProjectModal';

describe('SuggestProjectModal', function () {
  it('renders', function () {
    const props = {
      organization: TestStubs.Organization(),
      matchedUserAgentString: 'okhttp/',
      Body: p => p.children,
      Header: p => p.children,
      Footer: p => p.children,
    };

    const wrapper = render(<SuggestProjectModal {...props} />);
    expect(wrapper.container).toSnapshot();
  });
});
