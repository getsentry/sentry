import {mountWithTheme} from 'sentry-test/enzyme';

import ClipboardTooltip from 'app/components/clipboardTooltip';
import {OPEN_DELAY} from 'app/components/tooltip';

describe('ClipboardTooltip', function () {
  it('renders', function () {
    const title = 'tooltip content';
    const wrapper = mountWithTheme(
      <ClipboardTooltip title={title}>
        <span>This text displays a tooltip when hovering</span>
      </ClipboardTooltip>
    );

    jest.useFakeTimers();

    const trigger = wrapper.find('span');
    trigger.simulate('mouseEnter');

    jest.advanceTimersByTime(OPEN_DELAY);
    wrapper.update();

    const tooltipClipboardWrapper = wrapper.find('TooltipClipboardWrapper');
    expect(tooltipClipboardWrapper.length).toEqual(1);

    const tooltipTextContent = tooltipClipboardWrapper.find('TextOverflow');
    expect(tooltipTextContent.length).toEqual(1);

    const clipboardContent = tooltipClipboardWrapper.find('Clipboard');
    expect(clipboardContent.length).toEqual(1);
    expect(clipboardContent.props().value).toEqual(title);

    const iconCopy = clipboardContent.find('IconCopy');
    expect(iconCopy.length).toEqual(1);
  });
});
