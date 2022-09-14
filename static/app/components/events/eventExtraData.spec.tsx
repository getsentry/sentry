import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import EventExtraData from 'sentry/components/events/eventExtraData';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

describe('EventExtraData', function () {
  it('display redacted data', async function () {
    const event = {
      ...TestStubs.Event(),
      context: {
        'sys.argv': ['', '', '', '', '', '', '', '', '', ''],
        sdk: {
          clientIP: '127.0.0.1',
          version: '3.16.1',
          name: 'raven-js',
          upstream: {
            url: 'https://docs.sentry.io/clients/javascript/',
            isNewer: '\n',
          },
        },
      },
      _meta: {
        context: {
          'sys.argv': {
            '0': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 49,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '1': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 17,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '2': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 12,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '3': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '4': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 30,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '5': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '6': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 18,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '7': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '8': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 26,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '9': {
              '': {
                rem: [['organization:2', 's', 0, 0]],
                len: 8,
                chunks: [
                  {
                    type: 'redaction',
                    text: '',
                    rule_id: 'organization:2',
                    remark: 's',
                  },
                ],
              },
            },
            '': {
              len: 14,
            },
          },
        },
      },
    };

    const {organization, router} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        relayPiiConfig: JSON.stringify(TestStubs.DataScrubbingRelayPiiConfig()),
      },
    });

    render(
      <OrganizationContext.Provider value={organization}>
        <RouteContext.Provider
          value={{
            router,
            location: router.location,
            params: {},
            routes: [],
          }}
        >
          <EventExtraData event={event} />
        </RouteContext.Provider>
      </OrganizationContext.Provider>
    );

    expect(await screen.findAllByText(/redacted/)).toHaveLength(10);

    userEvent.hover(screen.getAllByText(/redacted/)[0]);

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the PII rule [Replace] [[a-zA-Z0-9]+] with [Placeholder] from [$message] in the settings of the organization org-slug'
        )
      )
    ).toBeInTheDocument(); // tooltip description

    expect(screen.getByText('isNewer')).toBeInTheDocument(); // key
    expect(screen.queryByText('\\n')).not.toBeInTheDocument(); // value
  });
});
