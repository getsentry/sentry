import type {ReactNode} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsToolbar} from 'sentry/views/explore/logs/logsToolbar';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('LogsToolbar', () => {
  describe('visualize section', () => {
    it('options disabled', async () => {
      render(
        <Wrapper>
          <LogsToolbar numberTags={{}} stringTags={{}} />
        </Wrapper>
      );

      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      const options = screen.getAllByRole('option');

      const aggregates: Array<[string, boolean]> = [
        ['count', true],
        ['count unique', true],
        ['sum', false],
        ['avg', false],
        ['p50', false],
        ['p75', false],
        ['p90', false],
        ['p95', false],
        ['p99', false],
        ['max', false],
        ['min', false],
      ];

      expect(options).toHaveLength(aggregates.length);

      for (let i = 0; i < aggregates.length; i++) {
        const [name, enabled] = aggregates[i]!;
        expect(options[i]).toHaveTextContent(name);
        if (enabled) {
          expect(options[i]).not.toHaveAttribute('aria-disabled', 'true');
        } else {
          expect(options[i]).toHaveAttribute('aria-disabled', 'true');
        }
      }
    });

    it('uses the right default when switching aggregates', async () => {
      const {router} = render(
        <Wrapper>
          <LogsToolbar numberTags={{foo: {key: 'foo', name: 'foo'}}} stringTags={{}} />
        </Wrapper>
      );

      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'count unique'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count_unique(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getByRole('button', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(foo)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getByRole('button', {name: 'avg'}));
      await userEvent.click(screen.getByRole('option', {name: 'count'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });

    it('switches the parameter', async () => {
      const {router} = render(
        <Wrapper>
          <LogsToolbar
            numberTags={{bar: {key: 'bar', name: 'bar'}, foo: {key: 'foo', name: 'foo'}}}
            stringTags={{
              message: {key: 'message', name: 'message'},
              severity: {key: 'severity', name: 'severity'},
            }}
          />
        </Wrapper>
      );

      let options: HTMLElement[];

      // count has no user changable argument
      expect(screen.getByRole('button', {name: 'logs'})).toBeDisabled();

      // count unique only shows string attributes
      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('button', {name: 'message'})); // this one isnt remapped for some reason
      options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('barnumber');
      expect(options[1]).toHaveTextContent('foonumber');
      expect(options[2]).toHaveTextContent('message'); // this one isnt remapped for some reason
      expect(options[3]).toHaveTextContent('severity');
      await userEvent.click(screen.getByRole('option', {name: 'severity'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count_unique(severity)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      // avg shows only number attributes
      await userEvent.click(screen.getByRole('button', {name: 'count unique'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));
      await userEvent.click(screen.getByRole('button', {name: 'bar'})); // this one isnt remapped for some reason
      options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('bar'); // this one isnt remapped for some reason
      expect(options[1]).toHaveTextContent('foo');
      await userEvent.click(screen.getByRole('option', {name: 'foo'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(foo)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });

    it('can add/delete visualizes', async () => {
      const {router} = render(
        <Wrapper>
          <LogsToolbar
            numberTags={{bar: {key: 'bar', name: 'bar'}, foo: {key: 'foo', name: 'foo'}}}
            stringTags={{
              message: {key: 'message', name: 'message'},
              severity: {key: 'severity', name: 'severity'},
            }}
          />
        </Wrapper>
      );

      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      await userEvent.click(screen.getByRole('button', {name: 'Add Chart'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['avg(bar)']}, {yAxes: ['count(message)']}].map(
          aggregateField => JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getAllByLabelText('Remove Overlay')[0]!);
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });
  });

  describe('group by section', () => {
    it('can switch group bys', async () => {
      let mode: Mode | undefined = undefined;

      function Component() {
        mode = useQueryParamsMode();
        return (
          <LogsToolbar
            numberTags={{
              bar: {key: 'bar', name: 'bar'},
              foo: {key: 'foo', name: 'foo'},
            }}
            stringTags={{
              message: {key: 'message', name: 'message'},
              severity: {key: 'severity', name: 'severity'},
            }}
          />
        );
      }
      const {router} = render(
        <Wrapper>
          <Component />
        </Wrapper>
      );

      expect(mode).toEqual(Mode.SAMPLES);

      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'message'}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );

      expect(mode).toEqual(Mode.AGGREGATE);

      await userEvent.click(within(editorColumn).getByRole('button', {name: 'message'}));
      await userEvent.click(screen.getByRole('option', {name: 'severity'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'severity'}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
      expect(mode).toEqual(Mode.AGGREGATE);
    });

    it('can add/delete group bys', async () => {
      const {router} = render(
        <Wrapper>
          <LogsToolbar
            numberTags={{bar: {key: 'bar', name: 'bar'}, foo: {key: 'foo', name: 'foo'}}}
            stringTags={{
              message: {key: 'message', name: 'message'},
              severity: {key: 'severity', name: 'severity'},
            }}
          />
        </Wrapper>
      );

      const editorColumn = screen.getAllByTestId('editor-column')[0]!;
      await userEvent.click(within(editorColumn).getByRole('button', {name: '\u2014'}));
      await userEvent.click(screen.getByRole('option', {name: 'message'}));

      await userEvent.click(screen.getByRole('button', {name: 'Add Group'}));
      expect(router.location.query.aggregateField).toEqual(
        [{groupBy: 'message'}, {groupBy: ''}, {yAxes: ['count(message)']}].map(
          aggregateField => JSON.stringify(aggregateField)
        )
      );

      await userEvent.click(screen.getAllByLabelText('Remove Column')[0]!);
      expect(router.location.query.aggregateField).toEqual(
        // BUG: a little weird that the 2nd group by moves up to take its place
        [{groupBy: ''}, {yAxes: ['count(message)']}].map(aggregateField =>
          JSON.stringify(aggregateField)
        )
      );
    });
  });
});
