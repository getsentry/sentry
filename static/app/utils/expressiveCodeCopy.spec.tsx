import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {handleExpressiveCodeCopyClick} from 'sentry/utils/expressiveCodeCopy';

function StoryCodeBlock() {
  return (
    <main onClick={handleExpressiveCodeCopyClick}>
      <div className="expressive-code">
        <div className="copy">
          <button
            type="button"
            data-code={'<Container>\u007F  Content\u007F</Container>'}
          >
            Copy
          </button>
        </div>
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
});
