import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TextCopyInput from 'sentry/components/forms/textCopyInput';

describe('TextCopyInput', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(container).toSnapshot();
    expect(screen.getByDisplayValue('Text to Copy')).toBeInTheDocument();
  });
});
