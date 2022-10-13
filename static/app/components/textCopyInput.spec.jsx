import {render, screen} from 'sentry-test/reactTestingLibrary';

import TextCopyInput from 'sentry/components/textCopyInput';

describe('TextCopyInput', function () {
  it('renders', function () {
    const {container} = render(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(container).toSnapshot();
    expect(screen.getByDisplayValue('Text to Copy')).toBeInTheDocument();
  });
});
