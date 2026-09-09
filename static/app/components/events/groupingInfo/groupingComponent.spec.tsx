import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {EventGroupComponent} from 'sentry/types/event';

import {GroupingComponent} from './groupingComponent';

function component(
  id: string,
  values: EventGroupComponent['values'],
  contributes = true
): EventGroupComponent {
  return {id, values, contributes, name: null, hint: null};
}

describe('GroupingComponent', () => {
  it('preserves nested disclosure state when its parent is collapsed', async () => {
    render(
      <GroupingComponent
        component={component('exception', [
          component('frame', [component('function', ['handleRequest'])]),
        ])}
        showNonContributing={false}
      />
    );
    const frame = screen.getByRole('button', {name: 'frame'});
    await userEvent.click(frame);
    expect(frame).toHaveAttribute('aria-expanded', 'false');
    const exception = screen.getByRole('button', {name: 'exception'});
    await userEvent.click(exception);
    expect(exception).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(exception);
    expect(screen.getByRole('button', {name: 'frame'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await userEvent.click(screen.getByRole('button', {name: 'frame'}));
    expect(screen.getByText('handleRequest')).toBeVisible();
  });

  it('preserves a contributing sibling’s state when filtering other values', async () => {
    const tree = component('exception', [
      component('ignored', ['unused'], false),
      component('frame', [component('function', ['handleRequest'])]),
    ]);
    const {rerender} = render(
      <GroupingComponent component={tree} showNonContributing={false} />
    );
    expect(screen.queryByText('unused')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'frame'}));
    rerender(<GroupingComponent component={tree} showNonContributing />);
    expect(screen.getByText('unused')).toBeVisible();
    expect(screen.getByRole('button', {name: 'frame'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('expands similar frames and resets their default when the filter changes', async () => {
    const tree = component(
      'stacktrace',
      ['first', 'second', 'third', 'fourth'].map(name =>
        component('frame', [component('function', [name])])
      )
    );
    const {rerender} = render(
      <GroupingComponent component={tree} showNonContributing={false} />
    );
    expect(screen.getByText('first')).toBeVisible();
    expect(screen.getByText('second')).toBeVisible();
    const expand = screen.getByRole('button', {name: 'show 2 similar'});
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(expand);
    expect(screen.getByText('third')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'collapse 2 similar'}));
    rerender(<GroupingComponent component={tree} showNonContributing />);
    expect(screen.getByText('third')).toBeVisible();
    rerender(<GroupingComponent component={tree} showNonContributing={false} />);
    expect(screen.getByRole('button', {name: 'show 2 similar'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
