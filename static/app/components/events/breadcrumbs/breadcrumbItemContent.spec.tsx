import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbItemContent} from 'sentry/components/events/breadcrumbs/breadcrumbItemContent';
import {
  BreadcrumbLevelType,
  BreadcrumbMessageFormat,
  BreadcrumbType,
  type BreadcrumbTypeDefault,
  type BreadcrumbTypeHTTP,
} from 'sentry/types/breadcrumbs';

describe('BreadcrumbItemContent', () => {
  it.each([true, false])(
    'does not repeat a single console message when fullyExpanded is %s',
    fullyExpanded => {
      const breadcrumb: BreadcrumbTypeDefault = {
        type: BreadcrumbType.DEFAULT,
        category: 'console',
        level: BreadcrumbLevelType.INFO,
        message: 'UndoManager: startGroupIfNeeded',
        data: {logger: 'console', arguments: ['UndoManager: startGroupIfNeeded']},
      };
      const {container} = render(
        <BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={fullyExpanded} />
      );

      expect(container).toHaveTextContent(/^UndoManager: startGroupIfNeeded$/);
      expect(breadcrumb.data).toEqual({
        logger: 'console',
        arguments: ['UndoManager: startGroupIfNeeded'],
      });
    }
  );

  it('keeps additional data when removing repeated console arguments', () => {
    render(
      <BreadcrumbItemContent
        breadcrumb={{
          type: BreadcrumbType.DEFAULT,
          category: 'console',
          level: BreadcrumbLevelType.INFO,
          message: 'message',
          data: {logger: 'console', arguments: ['message'], detail: 'extra detail'},
        }}
      />
    );

    expect(screen.getByText('extra detail')).toBeInTheDocument();
    expect(screen.queryByText('arguments')).not.toBeInTheDocument();
  });

  it.each([
    {category: 'console', data: {logger: 'console', arguments: ['different message']}},
    {category: 'console', data: {logger: 'console', arguments: ['message', 'extra']}},
    {category: 'console', data: {logger: 'console', arguments: [{value: 'message'}]}},
    {category: 'custom', data: {logger: 'console', arguments: ['message']}},
    {category: 'console', data: {logger: 'custom', arguments: ['message']}},
  ])('keeps console data that is not redundant: %j', ({category, data}) => {
    render(
      <BreadcrumbItemContent
        breadcrumb={{
          type: BreadcrumbType.DEFAULT,
          level: BreadcrumbLevelType.INFO,
          message: 'message',
          category,
          data,
        }}
      />
    );

    expect(screen.getByText('arguments')).toBeInTheDocument();
  });

  it('keeps annotations on repeated console arguments', () => {
    render(
      <BreadcrumbItemContent
        breadcrumb={{
          type: BreadcrumbType.DEFAULT,
          category: 'console',
          level: BreadcrumbLevelType.INFO,
          message: '[Filtered]',
          data: {logger: 'console', arguments: ['[Filtered]']},
        }}
        meta={{data: {arguments: {'0': {'': {rem: [['@password', 's']]}}}}}}
      />
    );

    expect(screen.getByText('arguments')).toBeInTheDocument();
  });

  it('renders default crumbs with all data', () => {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message: 'my message',
      data: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6},
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} fullyExpanded={false} />);
    expect(screen.getByText(breadcrumb.message!)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
  });

  it('renders HTTP crumbs with all data', () => {
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
    expect(screen.getByText(breadcrumb.message!)).toBeInTheDocument();
    // Link is rendered in a span between method and status code
    expect(
      screen.getByText(`${breadcrumb.data?.method}: [${breadcrumb.data?.status_code}]`)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: breadcrumb.data?.url})).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('15080')).toBeInTheDocument();
  });

  it('renders SQL crumbs with all data', () => {
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
      screen.getByText(breadcrumb.message!, {selector: '.token'})
    ).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
  });

  it('renders exception crumbs with all data', () => {
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
    expect(screen.getByText(breadcrumb.message!)).toBeInTheDocument();
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
    expect(screen.getByText(breadcrumb.message!)).toBeInTheDocument();
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
    expect(screen.getByText(breadcrumb.message!)).toBeInTheDocument();
    expect(screen.getByText(breadcrumb?.data?.type)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    itemWithoutValue.unmount();
  });

  it('renders exception crumbs with array of objects', () => {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.ERROR,
      level: BreadcrumbLevelType.ERROR,
      data: {
        type: 'ValidationError',
        value: [
          {field: 'email', error: 'invalid'},
          {field: 'password', error: 'too short'},
        ],
      },
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} />);
    expect(
      screen.getByText(
        'ValidationError: {"field":"email","error":"invalid"}, {"field":"password","error":"too short"}'
      )
    ).toBeInTheDocument();
  });

  it('renders colored text without escape codes for ANSI messages', () => {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message: '\x1B[31mfailed\x1B[0m to connect',
    };
    const {container} = render(<BreadcrumbItemContent breadcrumb={breadcrumb} />);
    expect(container).toHaveTextContent(/^failed to connect$/);
    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
  });

  it('renders colored text without escape codes for ANSI exception values', () => {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.ERROR,
      level: BreadcrumbLevelType.ERROR,
      data: {type: 'ConnectionError', value: '\x1B[31mfailed\x1B[0m to connect'},
    };
    const {container} = render(<BreadcrumbItemContent breadcrumb={breadcrumb} />);
    expect(container).toHaveTextContent(/^ConnectionError: failed to connect$/);
    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
  });

  it('renders annotated text for ANSI messages with meta', () => {
    const breadcrumb: BreadcrumbTypeDefault = {
      type: BreadcrumbType.DEBUG,
      level: BreadcrumbLevelType.INFO,
      message: '\x1B[31mfailed\x1B[0m to connect to [Filtered]',
    };
    const meta = {
      message: {
        '': {
          chunks: [
            {type: 'text', text: '\x1B[31mfailed\x1B[0m to connect to '},
            {type: 'redaction', text: '[Filtered]', rule_id: '@password', remark: 's'},
          ],
        },
      },
    };
    render(<BreadcrumbItemContent breadcrumb={breadcrumb} meta={meta} />);
    expect(screen.getByText('[Filtered]')).toBeInTheDocument();
    expect(screen.queryByText('failed')).not.toBeInTheDocument();
  });

  it('applies item limits with fullyExpanded', () => {
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
    expect(screen.getByText(longMessage)).toBeInTheDocument();
    expect(screen.getByText('6 items')).toBeInTheDocument();
    compactItem.unmount();

    render(<BreadcrumbItemContent breadcrumb={breadcrumb} />);
    expect(screen.getByText(longMessage)).toBeInTheDocument();
    expect(screen.queryByText('6 items')).not.toBeInTheDocument();
  });
});
