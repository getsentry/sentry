import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Frame} from 'sentry/types/event';

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

  it('renders and copies extracted native variables when the flag is enabled', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {writeText}});

    render(
      <Context
        isExpanded
        hasContextVars
        platform="native"
        frame={{...frame, vars: {argc: '0x2 (int)'}}}
        event={event}
        registers={{}}
        components={[]}
      />,
      {organization: OrganizationFixture({features: ['native-variable-extraction']})}
    );

    expect(screen.getByText('0x2 (int)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy argc value'}));
    expect(writeText).toHaveBeenCalledWith('0x2 (int)');
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
