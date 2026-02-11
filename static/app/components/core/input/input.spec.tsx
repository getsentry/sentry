import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Input} from '.';

describe('Input', () => {
  it('maps nativeSize to size', () => {
    render(<Input size="md" nativeSize={5} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('size', '5');
  });
});
