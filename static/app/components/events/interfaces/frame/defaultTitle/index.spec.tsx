import {FrameFixture} from 'sentry-fixture/frame';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DefaultTitle} from 'sentry/components/events/interfaces/frame/defaultTitle';

describe('DefaultTitle', () => {
  const filename = `/source/${'long directory with spaces/'.repeat(10)}main.go`;

  it.each([filename, null])(
    'shows the complete truncated filename when absPath is %s',
    async absPath => {
      render(
        <DefaultTitle
          frame={FrameFixture({filename, absPath, platform: 'go'})}
          platform="go"
        />
      );

      await userEvent.hover(screen.getByTestId('filename'));

      expect(
        await screen.findByText(filename, {selector: '[data-tooltip]'})
      ).toBeVisible();
    }
  );

  it('keeps the absolute path in the tooltip when it differs from the filename', async () => {
    const absPath = `/absolute${filename}`;
    render(<DefaultTitle frame={FrameFixture({filename, absPath})} platform="go" />);

    await userEvent.hover(screen.getByTestId('filename'));

    expect(await screen.findByText(absPath, {selector: '[data-tooltip]'})).toBeVisible();
  });
});
