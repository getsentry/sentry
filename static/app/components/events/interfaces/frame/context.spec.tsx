import {ThemeProvider} from '@emotion/react';
import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Frame} from 'sentry/types/event';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {Context} from './context';

describe('Frame - Context', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const event = EventFixture({projectID: project.id});
  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  describe.each([lightTheme, darkTheme])('$type theme active line', theme => {
    it.each([true, false])('highlights the current frame (expanded: %s)', isExpanded => {
      render(
        <ThemeProvider theme={theme}>
          <Context
            isExpanded={isExpanded}
            hasContextSource
            frame={{
              ...frame,
              lineNo: 81,
              context: [
                [80, 'note = ""'],
                [81, 'capture_exception(exc)'],
                [82, 'return note'],
              ],
            }}
            event={event}
            registers={{}}
            components={[]}
          />
        </ThemeProvider>,
        {organization: org}
      );

      const rows = screen.getAllByTestId('context-line');
      expect(rows).toHaveLength(isExpanded ? 3 : 1);
      const activeRow = rows[isExpanded ? 1 : 0]!;
      expect(activeRow).toHaveAttribute('aria-current', 'location');
      expect(activeRow).toContainElement(
        screen.getByRole('img', {name: 'Current frame line'})
      );
      // All syntax tokens on the yellow row inherit its contrasting text color.
      expect(activeRow.querySelector('.token')).not.toBeInTheDocument();
      expect(activeRow).toHaveTextContent('capture_exception(exc)');

      if (isExpanded) {
        for (const row of [rows[0]!, rows[2]!]) {
          expect(row).not.toHaveAttribute('aria-current');
          expect(row.querySelector('.token')).toBeInTheDocument();
        }
      }
    });
  });

  it('does not mark a line when the frame line is absent from the context', () => {
    render(
      <Context
        isExpanded
        hasContextSource
        frame={{...frame, context: [[1, 'return note']]}}
        event={event}
        registers={{}}
        components={[]}
      />,
      {organization: org}
    );

    expect(
      screen.queryByRole('img', {name: 'Current frame line'})
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('context-line')).not.toHaveAttribute('aria-current');
  });

  describe('syntax highlighting', () => {
    it('renders code correctly when context lines end in newline characters', () => {
      const testFrame: Frame = {
        ...frame,
        lineNo: 2,
        context: [
          [1, 'this is line 1\n'],
          [2, 'this is line 2\n'],
          [3, 'this is line 3\n'],
        ],
      };

      render(
        <Context
          isExpanded
          hasContextSource
          frame={testFrame}
          event={event}
          registers={{}}
          components={[]}
        />,
        {organization: org}
      );

      expect(screen.getAllByTestId('context-line')).toHaveLength(3);

      expect(screen.getByText('this is line 1')).toBeInTheDocument();
      expect(screen.getByText('this is line 2')).toBeInTheDocument();
      expect(screen.getByText('this is line 3')).toBeInTheDocument();
    });
  });
});
