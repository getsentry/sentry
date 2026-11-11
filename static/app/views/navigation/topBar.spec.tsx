import type {ComponentProps} from 'react';
import {IconStack} from '@sentry/icons/stack';
import {expectTypeOf} from 'expect-type';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {trackAnalytics} from 'sentry/utils/analytics';
import {
  SeerExplorerContext,
  type SeerExplorerContextValue,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

import {TopBar} from './topBar';

jest.mock('sentry/utils/analytics');

const theme = ThemeFixture();

const mockOpenFeedbackForm = jest.fn();
jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => mockOpenFeedbackForm,
}));

jest.mock('sentry/utils/seer/isSeerExplorerEnabled', () => ({
  ...jest.requireActual('sentry/utils/seer/isSeerExplorerEnabled'),
  isSeerExplorerEnabled: () => true,
}));

function renderTopBar(width?: number) {
  if (width !== undefined) {
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);
  }

  const topBar = (
    <TopBar.Slot.Provider>
      <TopBar />
      <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: 'Page title'}} />
    </TopBar.Slot.Provider>
  );

  render(<Flex containerType="inline-size">{topBar}</Flex>, {
    organization: OrganizationFixture({
      features: ['seer-explorer'],
    }),
  });
}

describe('TopBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the title as an h1 by default', () => {
    renderTopBar();

    expect(
      screen.getByRole('heading', {name: 'Page title', level: 1})
    ).toBeInTheDocument();
  });

  it('keeps only the page-title label inside the single TopBar heading', () => {
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'page-title',
            label: 'Current Issue',
            leadingGraphic: <IconStack data-test-id="title-graphic" />,
            pagination: {
              previous: {ariaLabel: 'Previous issue'},
              next: {ariaLabel: 'Next issue', to: '/issues/next/'},
            },
            trailingActions: {
              type: 'button',
              element: <Button>Resolve</Button>,
            },
          }}
          items={[{type: 'link', label: 'Issues', to: '/issues/'}]}
        />
      </TopBar.Slot.Provider>,
      {organization: OrganizationFixture()}
    );

    expect(screen.queryByRole('heading', {name: 'Issues'})).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Current Issue', level: 1})
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('banner')).getAllByRole('heading', {level: 1})
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('heading', {name: 'Current Issue', level: 1})).queryByRole(
        'link'
      )
    ).not.toBeInTheDocument();
    const heading = screen.getByRole('heading', {name: 'Current Issue', level: 1});
    expect(heading).not.toContainElement(screen.getByTestId('title-graphic'));
    expect(heading).not.toContainElement(
      screen.getByRole('button', {name: 'Previous issue'})
    );
    expect(heading).not.toContainElement(
      screen.getByRole('button', {name: 'Next issue'})
    );
    expect(heading).not.toContainElement(screen.getByRole('button', {name: 'Resolve'}));
    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute(
      'href',
      '/issues/'
    );
  });

  it('updates the title and removes it when the page unmounts', () => {
    function Page({title}: {title?: string}) {
      return (
        <TopBar.Slot.Provider>
          <TopBar />
          {title && (
            <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: title}} />
          )}
        </TopBar.Slot.Provider>
      );
    }

    const {rerender} = render(<Page title="First page" />);
    expect(screen.getByRole('heading', {name: 'First page'})).toBeInTheDocument();

    rerender(<Page title="Second page" />);
    expect(screen.getByRole('heading', {name: 'Second page'})).toBeInTheDocument();
    expect(screen.queryByText('First page')).not.toBeInTheDocument();

    rerender(<Page />);
    expect(screen.queryByText('Second page')).not.toBeInTheDocument();
  });

  it('supports an editable title', async () => {
    const onChange = jest.fn();
    render(
      <TopBar.Slot.Provider>
        <TopBar />
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'editable-title',
            value: 'My dashboard',
            'aria-label': 'Dashboard name',
            onChange,
          }}
        />
      </TopBar.Slot.Provider>
    );

    await userEvent.click(screen.getByText('My dashboard'));
    const input = screen.getByRole('textbox', {name: 'Dashboard name'});
    await userEvent.clear(input);
    await userEvent.type(input, 'New dashboard{Enter}');
    expect(onChange).toHaveBeenCalledWith('New dashboard');
  });

  it('requires a typed title on the breadcrumbs slot', () => {
    type Props = ComponentProps<typeof TopBar.Slot>;
    type ProjectSelector = Extract<
      BreadcrumbListProps['items'][number],
      {type: 'select'}
    >;
    expectTypeOf<{name: 'breadcrumbs'}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{children: string; name: 'title'}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{name: 'breadcrumbs'; title: string}>().not.toMatchTypeOf<Props>();
    expectTypeOf<{
      children: React.ReactNode;
      name: 'breadcrumbs';
      title: {label: string; type: 'page-title'};
    }>().not.toMatchTypeOf<Props>();
    expectTypeOf<{
      name: 'breadcrumbs';
      title: ProjectSelector & {label: string};
    }>().not.toMatchTypeOf<Props>();
    expectTypeOf<{
      name: 'breadcrumbs';
      title: {label: string; type: 'page-title'};
    }>().toMatchTypeOf<Props>();
  });

  it('uses icon-only actions below sm', async () => {
    renderTopBar(Number.parseFloat(theme.container.sm) - 1);

    expect(screen.queryByText('Ask Seer')).not.toBeInTheDocument();
    expect(screen.queryByText('Give Feedback')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByRole('button', {name: 'Give Feedback'}));
    expect(await screen.findByText('Give Feedback')).toBeInTheDocument();
  });

  it('shows the Ask Seer and Give Feedback labels at sm', () => {
    renderTopBar(Number.parseFloat(theme.container.sm));
    const askSeerButton = screen.getByRole('button', {name: 'Ask Seer'});

    expect(screen.getByText('Ask Seer')).toBeInTheDocument();
    expect(screen.getByText('Give Feedback')).toBeInTheDocument();
    expect(screen.queryByText('/')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toEqual([
      askSeerButton,
      screen.getByRole('button', {name: 'Give Feedback'}),
    ]);
  });

  describe('feedback slot', () => {
    const seerExplorerOpen: SeerExplorerContextValue = {
      closeSeerExplorer: jest.fn(),
      isOpen: true,
      openChatPrompt: jest.fn(),
      openSeerExplorer: jest.fn(),
      sessionState: 'inactive',
      sidebarContainerRef: {current: null},
      setSidebarPosition: jest.fn(),
      sidebarAppendInitialQuery: false,
      sidebarInitialQuery: undefined,
      sidebarKey: 0,
      sidebarPosition: 'auto',
      toggleSeerExplorer: jest.fn(),
      unreadCount: 0,
    };

    function renderFeedbackSlot(
      slot: React.ReactNode,
      {seerExplorer}: {seerExplorer?: SeerExplorerContextValue} = {}
    ) {
      jest
        .spyOn(Element.prototype, 'clientWidth', 'get')
        .mockReturnValue(Number.parseFloat(theme.container.sm));

      const content = (
        <TopBar.Slot.Provider>
          <TopBar />
          {slot}
        </TopBar.Slot.Provider>
      );

      render(
        <Flex containerType="inline-size">
          {seerExplorer ? (
            <SeerExplorerContext.Provider value={seerExplorer}>
              {content}
            </SeerExplorerContext.Provider>
          ) : (
            content
          )}
        </Flex>,
        {organization: OrganizationFixture()}
      );
    }

    beforeEach(() => {
      mockOpenFeedbackForm.mockClear();
    });

    it('uses the top navigation tags by default', async () => {
      renderFeedbackSlot(null);

      await userEvent.click(screen.getByRole('button', {name: 'Give Feedback'}));
      expect(mockOpenFeedbackForm).toHaveBeenCalledWith({
        tags: {'feedback.source': 'top_navigation'},
      });
    });

    it('replaces the default button with page feedback options', async () => {
      const feedbackOptions = {tags: {'feedback.source': 'page'}};
      renderFeedbackSlot(
        <TopBar.Slot name="feedback" feedbackOptions={feedbackOptions} />
      );

      expect(screen.getAllByRole('button', {name: 'Give Feedback'})).toHaveLength(1);
      expect(screen.getByText('Give Feedback')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Give Feedback'}));
      expect(mockOpenFeedbackForm).toHaveBeenCalledWith(feedbackOptions);
    });

    it('keeps the visible label when given a custom accessible name', () => {
      renderFeedbackSlot(
        <TopBar.Slot
          name="feedback"
          aria-label="Give feedback on this page"
          feedbackOptions={{tags: {'feedback.source': 'page'}}}
        />
      );

      expect(
        screen.getByRole('button', {name: 'Give feedback on this page'})
      ).toBeInTheDocument();
      expect(screen.getByText('Give Feedback')).toBeInTheDocument();
    });

    it('prefers Seer Explorer feedback options while the explorer is open', async () => {
      renderFeedbackSlot(
        <TopBar.Slot
          name="feedback"
          feedbackOptions={{tags: {'feedback.source': 'page'}}}
        />,
        {seerExplorer: seerExplorerOpen}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Give Feedback'}));
      expect(mockOpenFeedbackForm).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.objectContaining({'feedback.source': 'seer_explorer'}),
        })
      );
    });

    it('tracks clicks with the feedback source', async () => {
      renderFeedbackSlot(
        <TopBar.Slot
          name="feedback"
          feedbackOptions={{tags: {'feedback.source': 'page'}}}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Give Feedback'}));
      expect(trackAnalytics).toHaveBeenCalledWith(
        'navigation.feedback_button_clicked',
        expect.objectContaining({seer_explorer_open: false, source: 'page'})
      );
    });

    it('tracks the Seer Explorer source while the explorer is open', async () => {
      renderFeedbackSlot(null, {seerExplorer: seerExplorerOpen});

      await userEvent.click(screen.getByRole('button', {name: 'Give Feedback'}));
      expect(trackAnalytics).toHaveBeenCalledWith(
        'navigation.feedback_button_clicked',
        expect.objectContaining({seer_explorer_open: true, source: 'seer_explorer'})
      );
    });
  });

  it('does not render the command palette button', () => {
    renderTopBar(Number.parseFloat(theme.container.sm));

    expect(
      screen.queryByRole('button', {name: 'Command Palette'})
    ).not.toBeInTheDocument();
  });
});
