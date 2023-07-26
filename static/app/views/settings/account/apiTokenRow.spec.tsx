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

  it('calls onRemove callback when trash can is clicked', async () => {
    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={TestStubs.ApiToken()} />);

    await userEvent.click(screen.getByLabelText('Remove'));
    expect(cb).toHaveBeenCalled();
  });
});
