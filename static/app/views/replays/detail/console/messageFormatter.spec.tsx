import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  BreadcrumbLevelType,
  BreadcrumbType,
  BreadcrumbTypeDefault,
  Crumb,
} from 'sentry/types/breadcrumbs';

import MessageFormatter from './messageFormatter';

const breadcrumbs: Extract<Crumb, BreadcrumbTypeDefault>[] = [
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: ['This is a %s', 'test'],
      logger: 'console',
    },
    level: BreadcrumbLevelType.LOG,
    message: 'This is a %s test',
    timestamp: '2022-06-22T20:00:39.959Z',
    id: 1,
    color: 'purple300',
    description: 'Debug',
  },
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: ['test', 1, false, {}],
      logger: 'console',
    },
    level: BreadcrumbLevelType.LOG,
    message: 'test 1 false [object Object]',
    timestamp: '2022-06-22T16:49:11.198Z',
    id: 2,
    color: 'purple300',
    description: 'Debug',
  },
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: [{}],
      logger: 'console',
    },
    level: BreadcrumbLevelType.ERROR,
    message: 'Error: this is my error message',
    timestamp: '2022-06-22T20:00:39.958Z',
    id: 2,
    color: 'purple300',
    description: 'Debug',
  },
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: [{}],
      logger: 'console',
    },
    level: BreadcrumbLevelType.ERROR,
    timestamp: '2022-06-22T20:00:39.958Z',
    id: 3,
    color: 'red300',
    description: 'Error',
  },
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: [
        '%c prev state',
        'color: #9E9E9E; font-weight: bold',
        {
          cart: [],
        },
      ],
      logger: 'console',
    },
    level: BreadcrumbLevelType.LOG,
    message: '%c prev state color: #9E9E9E; font-weight: bold [object Object]',
    timestamp: '2022-06-09T00:50:25.273Z',
    id: 4,
    color: 'purple300',
    description: 'Debug',
  },
  {
    type: BreadcrumbType.DEBUG,
    category: 'console',
    data: {
      arguments: ['test', ['foo', 'bar']],
      logger: 'console',
    },
    level: BreadcrumbLevelType.LOG,
    message: 'test foo,bar',
    timestamp: '2022-06-23T17:09:31.158Z',
    id: 5,
    color: 'purple300',
    description: 'Debug',
  },
];

describe('MessageFormatter', () => {
  it('Should print console message with placeholders correctly', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[0]} />);

    expect(screen.getByText('This is a test')).toBeInTheDocument();
  });

  it('Should print console message with objects correctly', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[1]} />);

    expect(screen.getByText('test 1 false {}')).toBeInTheDocument();
  });

  it('Should print console message correctly when it is an Error object', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[2]} />);

    expect(screen.getByText('Error: this is my error message')).toBeInTheDocument();
  });

  it('Should print empty object in case there is no message prop', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[3]} />);

    expect(screen.getByText('{}')).toBeInTheDocument();
  });

  it('Should ignore the "%c" placheholder and print the console message correctly', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[4]} />);

    expect(screen.getByText('prev state {"cart":[]}')).toBeInTheDocument();
  });

  it('Should print arrays correctly', () => {
    render(<MessageFormatter breadcrumb={breadcrumbs[5]} />);

    expect(screen.getByText('test ["foo","bar"]')).toBeInTheDocument();
  });
});
