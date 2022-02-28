import {enzymeRender} from 'sentry-test/enzyme';

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

    const wrapper = enzymeRender(<SuggestProjectModal {...props} />);
    expect(wrapper).toSnapshot();
  });
});
