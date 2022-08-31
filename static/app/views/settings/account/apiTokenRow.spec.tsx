import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

describe('ApiTokenRow', () => {
  it('renders', () => {
    const wrapper = render(
      <ApiTokenRow onRemove={() => {}} token={TestStubs.ApiToken()} />
    );

    // Should be loading
    expect(wrapper.container).toSnapshot();
  });

  it('calls onRemove callback when trash can is clicked', () => {
    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={TestStubs.ApiToken()} />);

    userEvent.click(screen.getByRole('button'));
    expect(cb).toHaveBeenCalled();
  });
});
