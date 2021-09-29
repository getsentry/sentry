import copy from 'copy-text-to-clipboard';

import {fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ClipboardTooltip from 'app/components/clipboardTooltip';

jest.mock('copy-text-to-clipboard');

describe('ClipboardTooltip', function () {
  it('renders', async function () {
    const title = 'tooltip content';
    const content = 'This text displays a tooltip when hovering';
    const wrapper = mountWithTheme(
      <ClipboardTooltip title={title}>
        <span>{content}</span>
      </ClipboardTooltip>
    );

    expect(wrapper.getByText(content)).toBeInTheDocument();
    fireEvent.mouseEnter(wrapper.getByText(content));

    await wrapper.findByText(title);

    const clipboardContent = wrapper.getByLabelText('Copy to clipboard');
    expect(clipboardContent).toBeInTheDocument();
    fireEvent.click(clipboardContent);

    expect(copy).toHaveBeenCalledWith(title);
  });
});
