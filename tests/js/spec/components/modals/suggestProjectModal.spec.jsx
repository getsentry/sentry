import {mountWithTheme} from 'sentry-test/enzyme';

import SuggestProjectModal from 'app/components/modals/suggestProjectModal';

describe('SuggestProjectModal', function () {
  it('renders', function () {
    const props = {
      organization: TestStubs.Organization(),
      matchedUserAgentString: 'okhttp/',
      Body: p => p.children,
      Header: p => p.children,
      Footer: p => p.children,
    };

    const wrapper = mountWithTheme(<SuggestProjectModal {...props} />);
    expect(wrapper).toSnapshot();
  });
});
