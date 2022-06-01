import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {SAMPLING_DOC_LINK} from 'sentry/views/settings/project/sampling/utils';

import {renderComponent} from './utils';

describe('Filters and Sampling', function () {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    method: 'GET',
    body: TestStubs.Project(),
  });

  describe('renders', function () {
    it('empty', function () {
      const {container} = renderComponent(false);

      // Title
      expect(screen.getByText('Sampling')).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', SAMPLING_DOC_LINK);

      // Transaction traces and individual transactions rules container
      expect(
        screen.getByText(
          'Rules for traces should precede rules for individual transactions.'
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText('There are no transaction rules to display')
      ).toBeInTheDocument();

      expect(screen.getByText('Add transaction rule')).toBeInTheDocument();

      expect(
        screen.getByRole('button', {
          name: 'Read the docs',
        })
      ).toHaveAttribute('href', SAMPLING_DOC_LINK);

      expect(screen.getByText('Operator')).toBeInTheDocument();
      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('Rate')).toBeInTheDocument();

      expect(container).toSnapshot();
    });

    it('with rules', function () {
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

      const {container} = renderComponent(false);

      // Title
      expect(screen.getByText('Sampling')).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration. Any new rule may take a few minutes to propagate.'
          )
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole('link', {
          name: 'update your SDK configuration',
        })
      ).toHaveAttribute('href', SAMPLING_DOC_LINK);

      // Transaction traces and individual transactions rules container
      expect(
        screen.getByText(
          'Rules for traces should precede rules for individual transactions.'
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByText('There are no transaction rules to display')
      ).not.toBeInTheDocument();

      // Operator column
      const samplingRules = screen.getAllByTestId('sampling-rule');
      expect(samplingRules).toHaveLength(3);
      expect(samplingRules[0]).toHaveTextContent('If');
      expect(samplingRules[1]).toHaveTextContent('Else if');
      expect(samplingRules[2]).toHaveTextContent('Else');

      expect(screen.getByText('Add transaction rule')).toBeInTheDocument();

      expect(
        screen.getByRole('button', {
          name: 'Read the docs',
        })
      ).toHaveAttribute('href', SAMPLING_DOC_LINK);

      expect(screen.getByText('Operator')).toBeInTheDocument();
      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('Rate')).toBeInTheDocument();

      expect(container).toSnapshot();
    });
  });
});
