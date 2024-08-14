import {render, screen} from 'sentry-test/reactTestingLibrary';

import BreadcrumbItemContent from 'sentry/components/events/breadcrumbs/breadcrumbItemContent';
import {
  BreadcrumbLevelType,
  BreadcrumbMessageFormat,
  BreadcrumbType,
  type BreadcrumbTypeDefault,
  type BreadcrumbTypeHTTP,
} from 'sentry/types/breadcrumbs';

describe('BreadcrumbItemContent', function () {
  it('renders default crumbs with all data', function () {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message: 'my message',
      data: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6},
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />);
    expect(screen.getByText(breadcrumb.message as string)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
  });

  it('renders HTTP crumbs with all data', function () {
    const breadcrumb: BreadcrumbTypeHTTP = {
      type: BreadcrumbType.HTTP,
      level: BreadcrumbLevelType.INFO,
      message: 'my message',
      data: {
        method: 'GET',
        status_code: 500,
        url: 'https://example.com',
        someOtherData: 123,
        responseSize: 15080,
      },
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />);
    expect(screen.getByText(breadcrumb.message as string)).toBeInTheDocument();
    // Link is rendered in a span between method and status code
    expect(
      screen.getByText(`${breadcrumb.data?.method}: [${breadcrumb.data?.status_code}]`)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: breadcrumb.data?.url})).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('15080')).toBeInTheDocument();
  });

  it('renders SQL crumbs with all data', function () {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.QUERY,
      level: BreadcrumbLevelType.INFO,
      messageFormat: BreadcrumbMessageFormat.SQL,
      message: "SELECT * from 'table'",
      data: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6},
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />);
    // .token denotes Prism tokens for special formatting
    expect(
      screen.getByText(breadcrumb.message as string, {selector: '.token'})
    ).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
  });

  it('renders exception crumbs with all data', function () {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.WARNING,
      level: BreadcrumbLevelType.WARNING,
      message: 'Consider using more emoji',
      data: {
        type: 'EmojiError',
        value: '🔥🤔',
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
      },
    };
    const item = render(
      <BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />
    );
    expect(screen.getByText(breadcrumb.message as string)).toBeInTheDocument();
    expect(
      screen.getByText(`${breadcrumb?.data?.type}: ${breadcrumb?.data?.value}`)
    ).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    item.unmount();

    const itemWithoutType = render(
      <BreadcrumbItemContent
        breadcrumb={{
          ...breadcrumb,
          data: {
            ...breadcrumb.data,
            type: undefined,
          },
        }}
        fullyExpanded={false}
      />
    );
    expect(screen.getByText(breadcrumb.message as string)).toBeInTheDocument();
    expect(screen.getByText(breadcrumb?.data?.value)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    itemWithoutType.unmount();

    const itemWithoutValue = render(
      <BreadcrumbItemContent
        breadcrumb={{
          ...breadcrumb,
          data: {
            ...breadcrumb.data,
            value: undefined,
          },
        }}
        fullyExpanded={false}
      />
    );
    expect(screen.getByText(breadcrumb.message as string)).toBeInTheDocument();
    expect(screen.getByText(breadcrumb?.data?.type)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    itemWithoutValue.unmount();
  });

  it('applies item limits with fullyExpanded', function () {
    const longMessage = 'longMessage'.repeat(100);
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message: longMessage,
      data: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6},
    };
    const compactItem = render(
      <BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />
    );
    expect(
      screen.getByText(longMessage.substring(0, 200) + '\u2026')
    ).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    compactItem.unmount();

    render(<BreadcrumbItemContent breadcrumb={breadcrumb} />);
    expect(screen.getByText(longMessage)).toBeInTheDocument();
    expect(screen.queryByText('6 items')).not.toBeInTheDocument();
  });
});
