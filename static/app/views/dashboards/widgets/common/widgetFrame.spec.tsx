import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';

describe('WidgetFrame', () => {
  describe('Layout', () => {
    it('Renders the title and description', () => {
      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          showDescriptionInTooltip={false}
        />
      );

      expect(screen.getByText('EPS')).toBeInTheDocument();
      expect(screen.getByText('Number of events per second')).toBeInTheDocument();
    });
  });

  describe('Action Menu', () => {
    it('Renders a single action as a button', async () => {
      const onAction = jest.fn();

      render(
        <WidgetFrame
          title="EPS"
          description="Number of events per second"
          showDescriptionInTooltip={false}
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
          showDescriptionInTooltip={false}
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
});
