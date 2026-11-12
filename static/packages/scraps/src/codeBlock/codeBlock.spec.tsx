import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {CodeBlock} from '@sentry/scraps/codeBlock';
import {lightTheme} from '@sentry/scraps/theme';

function Example({children, ...props}: React.ComponentProps<typeof CodeBlock>) {
  return (
    <ThemeProvider theme={lightTheme}>
      <CodeBlock {...props}>{children}</CodeBlock>
    </ThemeProvider>
  );
}

describe('CodeBlock', () => {
  it('renders unknown languages as plain text', () => {
    render(<Example language="text">plain code</Example>);
    expect(screen.getByText('plain code')).toBeInTheDocument();
  });

  it('highlights asynchronously loaded code and notifies the consumer', async () => {
    const onAfterHighlight = jest.fn();
    render(
      <Example language="tsx" onAfterHighlight={onAfterHighlight}>
        {'const element = <Button />;'}
      </Example>
    );
    await waitFor(() => expect(onAfterHighlight).toHaveBeenCalled());
    expect(screen.getByText('Button')).toBeInTheDocument();
  });

  it('copies the code and reports success', async () => {
    const user = userEvent.setup();
    const onCopy = jest.fn();
    render(<Example onCopy={onCopy}>example code</Example>);
    await user.click(screen.getByRole('button', {name: 'Copy snippet'}));
    expect(await navigator.clipboard.readText()).toBe('example code');
    expect(onCopy).toHaveBeenCalledWith('example code');
    await user.hover(screen.getByRole('button', {name: 'Copy snippet'}));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('reports clipboard failure with accessible feedback', async () => {
    const user = userEvent.setup();
    jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new Error('denied'));
    render(<Example>example code</Example>);
    await user.click(screen.getByRole('button', {name: 'Copy snippet'}));
    await user.hover(screen.getByRole('button', {name: 'Copy snippet'}));
    expect(await screen.findByText('Unable to copy')).toBeInTheDocument();
  });

  it('keeps filename, controlled tabs and copy visibility configurable', async () => {
    const onTabClick = jest.fn();
    const user = userEvent.setup();
    render(
      <Example
        filename="example.ts"
        hideCopyButton
        tabs={[{label: 'TypeScript', value: 'ts'}]}
        selectedTab="ts"
        onTabClick={onTabClick}
      >
        example code
      </Example>
    );
    expect(screen.getByText('example.ts')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Copy snippet'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'TypeScript'}));
    expect(onTabClick).toHaveBeenCalledWith('ts');
  });
});
