import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';

describe('WidgetFrame', () => {
  describe('Layout', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('Renders the title and description', async () => {
      render(<WidgetFrame title="EPS" description="Number of events per second" />);

      expect(screen.getByText('EPS')).toBeInTheDocument();

      await userEvent.hover(screen.getByRole('button', {name: 'Widget description'}));
      expect(await screen.findByText('Number of events per second')).toBeInTheDocument();
    });

    it('Catches errors in the visualization', async () => {
      render(
        <WidgetFrame title="Uh Oh">
          <UhOh />
        </WidgetFrame>
      );

      expect(screen.getByText('Uh Oh')).toBeInTheDocument();

      expect(await screen.findByText(/cannot read properties/i)).toBeInTheDocument();
    });
  });

  describe('Warnings', () => {
    it('Shows the warnings in a tooltip', async () => {
      render(<WidgetFrame title="count()" warnings={['This widget has stale data']} />);

      expect(screen.queryByText('This widget has stale data')).not.toBeInTheDocument();

      await userEvent.hover(screen.getByRole('button', {name: 'Widget warnings'}));

      expect(await screen.findByText('This widget has stale data')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('Shows a single badge', () => {
      const {rerender} = render(<WidgetFrame title="count()" />);

      expect(screen.queryByText('Sampled')).not.toBeInTheDocument();

      rerender(<WidgetFrame title="count()" badgeProps={'Sampled'} />);

      expect(screen.getByText('Sampled')).toBeInTheDocument();
    });

    it('Shows multiple badges', () => {
      const {rerender} = render(<WidgetFrame title="count()" />);

      expect(screen.queryByText('Sampled')).not.toBeInTheDocument();

      rerender(<WidgetFrame title="count()" badgeProps={['Sampled', 'Extracted']} />);

      expect(screen.getByText('Sampled')).toBeInTheDocument();
      expect(screen.getByText('Extracted')).toBeInTheDocument();
    });
  });

  describe('Action Menu', () => {
    it('Renders a single action as a button', async () => {
      const onAction = jest.fn();

      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          actions={[
            {
              key: 'hello',
              label: 'Make Go',
              onAction,
            },
          ]}
        />
      );

      const $button = screen.getByRole('button', {name: 'Make Go'});
      expect($button).toBeInTheDocument();
      await userEvent.click($button);

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('Allows disabling a single action', async () => {
      const onAction = jest.fn();

      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          actionsDisabled
          actionsMessage="Actions are not supported"
          actions={[
            {
              key: 'hello',
              label: 'Make Go',
              onAction,
            },
          ]}
        />
      );

      const $button = screen.getByRole('button', {name: 'Make Go'});
      expect($button).toBeInTheDocument();
      expect($button).toBeDisabled();

      await userEvent.click($button);
      expect(onAction).not.toHaveBeenCalled();

      await userEvent.hover($button);
      expect(await screen.findByText('Actions are not supported')).toBeInTheDocument();
    });

    it('Renders multiple actions in a dropdown menu', async () => {
      const onAction1 = jest.fn();
      const onAction2 = jest.fn();

      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          actions={[
            {
              key: 'one',
              label: 'One',
              onAction: onAction1,
            },
            {
              key: 'two',
              label: 'Two',
              onAction: onAction2,
            },
          ]}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'One'}));
      expect(onAction1).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', {name: 'Widget actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Two'}));
      expect(onAction2).toHaveBeenCalledTimes(1);
    });

    it('Allows disabling multiple actions', async () => {
      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          actionsDisabled
          actionsMessage="Actions are not supported"
          actions={[
            {
              key: 'one',
              label: 'One',
            },
            {
              key: 'two',
              label: 'Two',
            },
          ]}
        />
      );

      const $trigger = screen.getByRole('button', {name: 'Widget actions'});
      await userEvent.click($trigger);

      expect(screen.queryByRole('menuitemradio', {name: 'One'})).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitemradio', {name: 'Two'})).not.toBeInTheDocument();

      await userEvent.hover($trigger);
      expect(await screen.findByText('Actions are not supported')).toBeInTheDocument();
    });

    it('Shows actions even in error state', async () => {
      const onAction = jest.fn();
      const error = new Error('Something is wrong');

      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          error={error}
          actions={[
            {
              key: 'hello',
              label: 'Make Go',
              onAction,
            },
          ]}
        />
      );

      const $button = screen.getByRole('button', {name: 'Make Go'});
      expect($button).toBeInTheDocument();
      await userEvent.click($button);

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('Shows a "Retry" action if a retry callback is provided', () => {
      const onRetry = jest.fn();
      const error = new Error('Something is wrong');

      render(<WidgetFrame title="EPS" error={error} onRetry={onRetry} />);

      expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    });
  });

  describe('Full Screen View Button', () => {
    it('Renders a full screen view button', async () => {
      const onFullScreenViewClick = jest.fn();
      const {rerender} = render(<WidgetFrame title="count()" />);

      expect(
        screen.queryByRole('button', {name: 'Open Full-Screen View'})
      ).not.toBeInTheDocument();

      rerender(
        <WidgetFrame title="count()" onFullScreenViewClick={onFullScreenViewClick} />
      );

      const $button = screen.getByRole('button', {name: 'Open Full-Screen View'});
      expect($button).toBeInTheDocument();
      await userEvent.click($button);

      expect(onFullScreenViewClick).toHaveBeenCalledTimes(1);
    });

    it('Hides full screen button if the widget has an error', () => {
      const onFullScreenViewClick = jest.fn();

      render(
        <WidgetFrame
          title="count()"
          onFullScreenViewClick={onFullScreenViewClick}
          error={new Error('Something went wrong')}
        />
      );

      const $button = screen.queryByRole('button', {name: 'Open Full-Screen View'});
      expect($button).not.toBeInTheDocument();
    });
  });
});

function UhOh() {
  const items: string[] = [];
  return <div>{items[0]!.toUpperCase()}</div>;
}
