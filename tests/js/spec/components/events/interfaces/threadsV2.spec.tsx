import userEvent from '@testing-library/user-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ThreadsV2 from 'app/components/events/interfaces/threadsV2';
import {EventOrGroupType} from 'app/types';
import {EntryType, Event} from 'app/types/event';
import {OrganizationContext} from 'app/views/organizationContext';

describe('ThreadsV2', function () {
  const {project, organization} = initializeOrg();

  describe('exception with stack trace and crashed thread without stack-trace', function () {
    const event: Event = {
      id: '020eb33f6ce64ed6adc60f8993535816',
      groupID: '68',
      eventID: '020eb33f6ce64ed6adc60f8993535816',
      projectID: '2',
      size: 3481,
      entries: [
        {
          data: {
            values: [
              {
                type: 'ZeroDivisionError',
                value: 'divided by 0',
                mechanism: null,
                threadId: null,
                module: '',
                stacktrace: {
                  frames: [
                    {
                      filename: 'puma (3.12.6) lib/puma/thread_pool.rb',
                      absPath: 'puma (3.12.6) lib/puma/thread_pool.rb',
                      module: null,
                      package: null,
                      platform: null,
                      instructionAddr: null,
                      symbolAddr: null,
                      function: 'block in spawn_thread',
                      rawFunction: null,
                      symbol: null,
                      context: [],
                      lineNo: 135,
                      colNo: null,
                      inApp: false,
                      trust: null,
                      errors: null,
                      vars: null,
                    },
                    {
                      filename: 'puma (3.12.6) lib/puma/server.rb',
                      absPath: 'puma (3.12.6) lib/puma/server.rb',
                      module: null,
                      package: null,
                      platform: null,
                      instructionAddr: null,
                      symbolAddr: null,
                      function: 'block in run',
                      rawFunction: null,
                      symbol: null,
                      context: [],
                      lineNo: 334,
                      colNo: null,
                      inApp: false,
                      trust: null,
                      errors: null,
                      vars: null,
                    },
                    {
                      filename: 'app/controllers/welcome_controller.rb',
                      absPath: 'app/controllers/welcome_controller.rb',
                      module: null,
                      package: null,
                      platform: null,
                      instructionAddr: null,
                      symbolAddr: null,
                      function: 'index',
                      rawFunction: null,
                      symbol: null,
                      context: [
                        [2, '  before_action :set_sentry_context\n'],
                        [3, '\n'],
                        [4, '  def index\n'],
                        [5, '    1 / 0\n'],
                        [6, '  end\n'],
                        [7, '\n'],
                        [8, '  def view_error\n'],
                      ],
                      lineNo: 5,
                      colNo: null,
                      inApp: true,
                      trust: null,
                      errors: null,
                      vars: null,
                      minGroupingLevel: 1,
                    },
                    {
                      filename: 'app/controllers/welcome_controller.rb',
                      absPath: 'app/controllers/welcome_controller.rb',
                      module: null,
                      package: null,
                      platform: null,
                      instructionAddr: null,
                      symbolAddr: null,
                      function: '/',
                      rawFunction: null,
                      symbol: null,
                      context: [
                        [2, '  before_action :set_sentry_context\n'],
                        [3, '\n'],
                        [4, '  def index\n'],
                        [5, '    1 / 0\n'],
                        [6, '  end\n'],
                        [7, '\n'],
                        [8, '  def view_error\n'],
                      ],
                      lineNo: 5,
                      colNo: null,
                      inApp: true,
                      trust: null,
                      errors: null,
                      vars: null,
                      minGroupingLevel: 0,
                    },
                  ],
                  framesOmitted: null,
                  registers: null,
                  hasSystemFrames: true,
                },
                rawStacktrace: null,
              },
            ],
            hasSystemFrames: true,
            excOmitted: null,
          },
          type: EntryType.EXCEPTION,
        },
        {
          data: {
            values: [
              {
                id: 13920,
                current: true,
                crashed: true,
                name: 'puma 002',
                stacktrace: null,
                rawStacktrace: null,
              },
            ],
          },
          type: EntryType.THREADS,
        },
      ],
      dist: null,
      message: '',
      title: 'ZeroDivisionError: divided by 0',
      location: 'app/controllers/welcome_controller.rb',
      user: null,
      contexts: {},
      sdk: null,
      context: {},
      packages: {},
      type: EventOrGroupType.ERROR,
      metadata: {
        display_title_with_tree_label: false,
        filename: 'app/controllers/welcome_controller.rb',
        finest_tree_label: [
          {filebase: 'welcome_controller.rb', function: '/'},
          {filebase: 'welcome_controller.rb', function: 'index'},
        ],
        function: '/',
        type: 'ZeroDivisionError',
        value: 'divided by 0',
      },
      tags: [{key: 'level', value: 'error'}],
      platform: 'other',
      dateReceived: '2021-10-28T12:28:22.318469Z',
      errors: [],
      crashFile: null,
      culprit: 'app/controllers/welcome_controller.rb in /',
      dateCreated: '2021-10-28T12:28:22.318469Z',
      fingerprints: ['58f1f47bea5239ea25397888dc9253d1'],
      groupingConfig: {
        enhancements: 'eJybzDRxY25-UmZOqpWRgZGhroGJroHRBABbUQb_',
        id: 'mobile:2021-02-12',
      },
      release: null,
      userReport: null,
      sdkUpdates: [],
      nextEventID: null,
      previousEventID: null,
    };

    const props: React.ComponentProps<typeof ThreadsV2> = {
      type: EntryType.THREADS,
      data: {
        values: [
          {
            id: 13920,
            current: true,
            crashed: true,
            name: 'puma 002',
            stacktrace: null,
            rawStacktrace: null,
          },
        ],
      },
      event,
      groupingCurrentLevel: 0,
      hasHierarchicalGrouping: true,
      projectId: project.id,
    };

    it('renders', function () {
      const {container} = mountWithTheme(
        <OrganizationContext.Provider
          value={{...organization, features: ['native-stack-trace-v2']}}
        >
          <ThreadsV2 {...props} />
        </OrganizationContext.Provider>
      );

      // Title
      expect(screen.getByRole('heading', {name: 'Stack Trace'})).toBeInTheDocument();

      // Actions
      expect(screen.getByRole('checkbox', {name: 'Raw'})).toBeInTheDocument();
      expect(screen.getByRole('checkbox', {name: 'Raw'})).not.toBeChecked();

      expect(screen.getByRole('button', {name: 'Options 1 Active'})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Sort By Recent first'})
      ).toBeInTheDocument();

      // Pill List

      // Stack Trace
      expect(
        screen.getByRole('heading', {name: 'ZeroDivisionError'})
      ).toBeInTheDocument();
      expect(screen.getByText('divided by 0')).toBeInTheDocument();

      expect(screen.getByRole('list', {name: 'Stack trace frames'})).toBeInTheDocument();
      expect(screen.queryAllByRole('listitem', {name: 'Stack trace frame'})).toHaveLength(
        4
      );

      expect(container).toSnapshot();
    });

    it('toggle raw button', function () {
      mountWithTheme(
        <OrganizationContext.Provider
          value={{...organization, features: ['native-stack-trace-v2']}}
        >
          <ThreadsV2 {...props} />
        </OrganizationContext.Provider>
      );

      expect(screen.getByRole('checkbox', {name: 'Raw'})).not.toBeChecked();
      userEvent.click(screen.getByRole('checkbox', {name: 'Raw'}));
      expect(screen.getByRole('checkbox', {name: 'Raw'})).toBeChecked();

      // Actions must not be rendered
      expect(
        screen.queryByRole('button', {name: 'Options 1 Active'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Sort By Recent first'})
      ).not.toBeInTheDocument();

      // Raw content is displayed
      expect(
        screen.queryByRole('list', {name: 'Stack trace frames'})
      ).not.toBeInTheDocument();
      expect(screen.queryAllByLabelText('Raw stack trace')).toHaveLength(1);
    });

    it('Toggle Sort By', async function () {
      mountWithTheme(
        <OrganizationContext.Provider
          value={{...organization, features: ['native-stack-trace-v2']}}
        >
          <ThreadsV2 {...props} />
        </OrganizationContext.Provider>
      );

      userEvent.click(screen.getByRole('button', {name: 'Sort By Recent first'}));
      expect(screen.getByTestId('dropdown-content-open')).toBeInTheDocument();
      expect(screen.queryAllByLabelText('Sort by option')).toHaveLength(2);

      // console.log(screen.queryAllByLabelText('Sort by option')[1].textContent);
      // const re = screen.queryAllByLabelText('Sort by option')[1];

      // userEvent.hover(re);
      // userEvent.click(re);

      // expect(
      //   await screen.findByRole('button', {name: 'Sort By Recent last'})
      // ).toBeInTheDocument();
    });
  });
});
