import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

describe('TextCopyInput', function () {
  it('renders', function () {
    mountWithTheme(<TextCopyInput>Text to Copy</TextCopyInput>);
    expect(screen.getByDisplayValue('Text to Copy')).toBeInTheDocument();
  });
});
