import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Default} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/default';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('Breadcrumb Data Default', function () {
  it('display redacted message', async function () {
    render(
      <Default
        meta={{
          message: {
            '': {
              rem: [['project:1', 's', 0, 0]],
              len: 19,
              chunks: [
                {
                  type: 'redaction',
                  text: '',
                  rule_id: 'project:1',
                  remark: 's',
                },
              ],
            },
          },
        }}
        event={TestStubs.Event()}
        orgSlug="org-slug"
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.DEBUG,
          timestamp: '2017-08-04T07:52:11Z',
          level: BreadcrumbLevelType.INFO,
          message: '',
          category: 'started',
          data: {
            controller: '<sentry_ios_cocoapods.ViewController: 0x100e09ec0>',
          },
          event_id: null,
        }}
      />
    );

    expect(
      screen.getByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Replaced because of PII rule "project:1"')
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted data', async function () {
    render(
      <Default
        meta={{
          data: {
            '': {
              rem: [['project:2', 'x']],
            },
          },
        }}
        event={TestStubs.Event()}
        orgSlug="org-slug"
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.DEBUG,
          timestamp: '2017-08-04T07:52:11Z',
          level: BreadcrumbLevelType.INFO,
          message: '',
          category: 'started',
          data: null,
          event_id: null,
        }}
      />
    );

    expect(
      screen.queryByText('<sentry_ios_cocoapods.ViewController: 0x100e09ec0>')
    ).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:2"')
    ).toBeInTheDocument(); // tooltip description
  });
});
