import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import NewConvention from 'sentry/views/codeConventions/newConvention';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

jest.mock('sentry/views/seerExplorer/useSeerExplorerContext', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/useSeerExplorerContext'),
  useSeerExplorerContext: jest.fn(),
}));

describe('NewConvention', () => {
  const openChatPrompt = jest.fn();

  beforeEach(() => {
    openChatPrompt.mockClear();
    jest
      .mocked(useSeerExplorerContext)
      .mockReturnValue({openChatPrompt} as unknown as ReturnType<
        typeof useSeerExplorerContext
      >);
  });

  it('offers Seer help once when the page opens', async () => {
    const organization = OrganizationFixture({
      features: ['seer-explorer', 'seer-explorer-chat-prompts'],
      openMembership: true,
      hideAiFeatures: false,
    });

    const {rerender} = render(<NewConvention />, {organization});

    expect(await screen.findByRole('textbox', {name: 'Why'})).toHaveValue('');
    rerender(<NewConvention />);

    expect(openChatPrompt).toHaveBeenCalledTimes(1);
    expect(openChatPrompt).toHaveBeenCalledWith({
      prompt: 'Do you need help describing a new convention?',
      context: expect.objectContaining({page: 'New code convention'}),
    });
  });

  it('does not open Seer without chat prompts', async () => {
    const organization = OrganizationFixture({
      features: ['seer-explorer'],
      openMembership: true,
      hideAiFeatures: false,
    });

    render(<NewConvention />, {organization});

    expect(await screen.findByRole('textbox', {name: 'Why'})).toBeInTheDocument();
    expect(openChatPrompt).not.toHaveBeenCalled();
  });
});
