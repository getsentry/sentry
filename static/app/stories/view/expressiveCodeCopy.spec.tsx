import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
// eslint-disable-next-line boundaries/dependencies -- unit test for a Stories-only helper
import {handleExpressiveCodeCopyClick} from 'sentry/stories/view/expressiveCodeCopy';

function StoryCodeBlock() {
  return (
    <main onClick={handleExpressiveCodeCopyClick}>
      <div className="expressive-code">
        <button type="button" data-code={'<Container>\u007F  Content\u007F</Container>'}>
          Copy
        </button>
      </div>
    </main>
  );
}

describe('handleExpressiveCodeCopyClick', () => {
  it('copies fenced MDX code blocks', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const addSuccessMessage = jest.spyOn(indicators, 'addSuccessMessage');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });

    render(<StoryCodeBlock />);
    fireEvent.click(screen.getByRole('button', {name: 'Copy'}));

    expect(writeText).toHaveBeenCalledWith('<Container>\n  Content\n</Container>');
    await waitFor(() =>
      expect(addSuccessMessage).toHaveBeenCalledWith('Copied to clipboard')
    );
  });

  it('does nothing when the Clipboard API is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    render(<StoryCodeBlock />);

    expect(() =>
      fireEvent.click(screen.getByRole('button', {name: 'Copy'}))
    ).not.toThrow();
  });
});
