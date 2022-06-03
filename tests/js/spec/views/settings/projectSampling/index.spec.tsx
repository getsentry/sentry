import {screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {SamplingRuleType} from 'sentry/types/sampling';
import {SAMPLING_DOC_LINK} from 'sentry/views/settings/project/sampling/utils';

import {renderComponent} from './utils';

describe('Sampling', function () {
  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project(),
    });

    const {container} = renderComponent({withModal: false});

    // Title
    expect(screen.getByText('Sampling')).toBeInTheDocument();

    // SubTitle
    expect(
      screen.getByText(
        /Here you can define what transactions count towards your quota without updating your SDK/
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'SDK sampling configuration',
      })
    ).toHaveAttribute('href', SAMPLING_DOC_LINK);

    // Rules tabs
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Rules tabs');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', {name: /Distributed Traces/})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', {name: /Individual Transactions/})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    // Tab content
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();

    // Empty message is displayed
    expect(
      screen.getByText('There are no transaction rules to display')
    ).toBeInTheDocument();

    // Actions
    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SAMPLING_DOC_LINK
    );

    expect(container).toSnapshot();
  });

  describe.only('renders with rules', function () {
    beforeAll(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/',
        method: 'GET',
        body: TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'trace',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 40,
              },
              {
                sampleRate: 0.2,
                type: 'transaction',
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'custom',
                      name: 'event.legacy_browser',
                      value: [
                        'ie_pre_9',
                        'ie9',
                        'ie10',
                        'ie11',
                        'safari_pre_6',
                        'opera_pre_15',
                        'opera_mini_pre_8',
                        'android_pre_4',
                      ],
                    },
                  ],
                },
                id: 41,
              },
              {
                sampleRate: 0.5,
                type: 'transaction',
                condition: {
                  op: 'and',
                  inner: [],
                },
                id: 42,
              },
            ],
            next_id: 43,
          },
        }),
      });
    });

    it('Distributed traces tab', async function () {
      const {container, router} = renderComponent({
        withModal: false,
        ruleType: SamplingRuleType.TRACE,
      });

      // Tab is active
      expect(
        await screen.findByRole('tab', {name: /Distributed Traces/})
      ).toHaveAttribute('aria-selected', 'true');

      // Tab description
      expect(
        screen.getByText(
          'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions.'
        )
      ).toBeInTheDocument();

      // Tab content
      expect(screen.getByTestId('sampling-rule')).toHaveTextContent('If');

      // Empty message is not displayed
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();

      // Switch tabs
      userEvent.click(screen.getByRole('tab', {name: /Individual Transactions/}));

      // Transaction tab is pushed to the router
      expect(router.push).toHaveBeenCalledWith(`${SamplingRuleType.TRANSACTION}/`);

      expect(container).toSnapshot();
    });

    it.only('Individual Transactions tab', async function () {
      const {container, router} = renderComponent({
        withModal: false,
        ruleType: SamplingRuleType.TRANSACTION,
      });

      // Tab is active
      expect(
        await screen.findByRole('tab', {name: /Individual Transactions/})
      ).toHaveAttribute('aria-selected', 'true');

      // Tab description
      screen.getByText(
        'Select Transactions only within this project which match your conditions.'
      );

      // Tab content
      const rules = screen.getAllByTestId('sampling-rule');
      expect(rules[0]).toHaveTextContent('If');
      expect(rules[1]).toHaveTextContent('Else');

      // Info Alert
      screen.getByText(
        textWithMarkupMatcher('1 Distributed Trace rule will initiate before these rules')
      );
      expect(
        screen.getByRole('link', {name: '1 Distributed Trace rule'})
      ).toHaveAttribute('href', `${SamplingRuleType.TRACE}/`);

      // Empty message is not displayed
      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();

      // Switch tabs
      userEvent.click(screen.getByRole('tab', {name: /Distributed Traces/}));

      // Distributed Traces tab is pushed to the router
      expect(router.push).toHaveBeenCalledWith(`${SamplingRuleType.TRACE}/`);

      expect(container).toSnapshot();
    });
  });
});
