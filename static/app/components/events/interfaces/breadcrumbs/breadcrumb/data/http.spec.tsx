import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Http} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/data/http';
import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';

describe('Breadcrumb Data Http', function () {
  it('display redacted url', async function () {
    render(
      <Http
        meta={{
          data: {
            url: {
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
          },
        }}
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.HTTP,
          level: BreadcrumbLevelType.INFO,
          data: {
            method: 'POST',
            url: '',
            status_code: 0,
          },
        }}
      />
    );

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Replaced because of PII rule "project:1"')
    ).toBeInTheDocument(); // tooltip description
  });

  it('display redacted data', async function () {
    render(
      <Http
        meta={{
          data: {
            '': {
              rem: [['project:2', 'x']],
            },
          },
        }}
        searchTerm=""
        breadcrumb={{
          type: BreadcrumbType.HTTP,
          level: BreadcrumbLevelType.INFO,
          data: null,
        }}
      />
    );

    expect(screen.queryByText('http://example.com/foo')).not.toBeInTheDocument();
    userEvent.hover(screen.getByText(/redacted/));
    expect(
      await screen.findByText('Removed because of PII rule "project:2"')
    ).toBeInTheDocument(); // tooltip description
  });
});
