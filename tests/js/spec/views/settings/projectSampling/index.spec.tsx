import {screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {SamplingRuleType} from 'sentry/types/sampling';
import {SAMPLING_DOC_LINK} from 'sentry/views/settings/project/sampling/utils';

import {renderComponent} from './utils';

describe('Sampling', function () {
  const EMPTY_MESSAGE = 'There are no transaction rules to display';

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project(),
    });

    renderComponent({withModal: false});

    // Subitle has the right link to the docs
    expect(
      screen.getByRole('link', {
        name: 'SDK sampling configuration',
      })
    ).toHaveAttribute('href', SAMPLING_DOC_LINK);

    // Rules tabs
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
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();

    // Empty message is displayed
    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();

    // Actions
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SAMPLING_DOC_LINK
    );
    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeInTheDocument();
  });

  it('renders distributed traces tab', function () {
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
          ],
          next_id: 41,
        },
      }),
    });

    const {router} = renderComponent({
      withModal: false,
      ruleType: SamplingRuleType.TRACE,
    });

    const tracesTab = screen.getByRole('tab', {name: /Distributed Traces/});
    // Tab is active
    expect(tracesTab).toHaveAttribute('aria-selected', 'true');
    // Tab has the correct number of rules badge
    expect(within(tracesTab).getByText('1')).toBeInTheDocument();

    // Tab description
    expect(
      screen.getByText(
        'Using a Trace ID, select all Transactions distributed across multiple projects/services which match your conditions.'
      )
    ).toBeInTheDocument();

    // Tab content
    expect(screen.getAllByTestId('sampling-rule').length).toBe(1);
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('If');
    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();

    // Empty message is not displayed
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();

    // Switch tabs
    userEvent.click(screen.getByRole('tab', {name: /Individual Transactions/}));

    // Transaction tab is pushed to the router
    expect(router.push).toHaveBeenCalledWith(`${SamplingRuleType.TRANSACTION}/`);
  });

  it('renders individual transactions tab', function () {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      method: 'GET',
      body: TestStubs.Project({
        dynamicSampling: {
          rules: [
            {
              sampleRate: 0.2,
              type: 'transaction',
              condition: {
                op: 'and',
                inner: [
                  {
                    op: 'eq',
                    name: 'event.environment',
                    value: ['prod'],
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

    const {router} = renderComponent({
      withModal: false,
      ruleType: SamplingRuleType.TRANSACTION,
    });

    const transactionsTab = screen.getByRole('tab', {name: /Individual Transactions/});
    // Tab is active
    expect(transactionsTab).toHaveAttribute('aria-selected', 'true');
    // Tab has the correct number of rules badge
    expect(within(transactionsTab).getByText('2')).toBeInTheDocument();

    // Tab description
    screen.getByText(
      'Select Transactions only within this project which match your conditions.'
    );

    // Tab content
    const rules = screen.getAllByTestId('sampling-rule');
    expect(rules.length).toBe(2);
    expect(rules[0]).toHaveTextContent('IfEnvironmentprod20%');
    expect(rules[1]).toHaveTextContent('Else50%');

    // Empty message is not displayed
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();

    // Switch tabs
    userEvent.click(screen.getByRole('tab', {name: /Distributed Traces/}));

    // Distributed Traces tab is pushed to the router
    expect(router.push).toHaveBeenCalledWith(`${SamplingRuleType.TRACE}/`);
  });
});
