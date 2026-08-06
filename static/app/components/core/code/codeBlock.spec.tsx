import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CodeBlock} from '@sentry/scraps/code';

describe('CodeBlock', () => {
  it('copies the source code', async () => {
    const code = 'const message = "Hello, Scraps!";';
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });

    render(<CodeBlock language="javascript">{code}</CodeBlock>);
    await userEvent.click(screen.getByRole('button', {name: 'Copy snippet'}));

    expect(writeText).toHaveBeenCalledWith(code);
  });
});
