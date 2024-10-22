import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';

describe('WidgetFrame', () => {
  describe('Layout', () => {
    it('Renders the title and description', async () => {
      render(<WidgetFrame title="EPS" description="Number of events per second" />);

      expect(screen.getByText('EPS')).toBeInTheDocument();

      await userEvent.hover(screen.getByTestId('more-information'));
      expect(await screen.findByText('Number of events per second')).toBeInTheDocument();
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
    it('Shows the badge', () => {
      const {rerender} = render(<WidgetFrame title="count()" />);

      expect(screen.queryByText('Sampled')).not.toBeInTheDocument();

      rerender(
        <WidgetFrame
          title="count()"
          badgeProps={{
            text: 'Sampled',
          }}
        />
      );

      expect(screen.getByText('Sampled')).toBeInTheDocument();
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

      await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'One'}));
      expect(onAction1).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', {name: 'Actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Two'}));
      expect(onAction2).toHaveBeenCalledTimes(1);
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
  });
});
