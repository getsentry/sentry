import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';

import {FieldRenderer} from './fieldRenderer';

const mockedEventData = {
  id: 'spanId',
  project: 'project-1',
  timestamp: '2024-10-03T10:15:00',
  trace: 'traceId',
  'span.op': 'test_op',
  'transaction.id': 'transactionId',
  'transaction.span_id': 'transactionSpanId',
  'span.description': 'GET /foo',
  'span.name': 'HTTP GET /foo',
};

describe('FieldRenderer tests', () => {
  const organization = OrganizationFixture();

  const location: Location = LocationFixture({
    query: {
      id: '42',
      name: 'best query',
      field: [
        'id',
        'timestamp',
        'trace',
        'span.op',
        'transaction.id',
        'span.description',
        'span.name',
      ],
    },
  });

  const eventView = EventView.fromLocation(location);

  beforeAll(() => {
    const mockTimestamp = new Date('2024-10-06T00:00:00').getTime();
    setMockDate(mockTimestamp);

    const projects = [
      ProjectFixture({
        id: '1',
        slug: 'project-1',
        name: 'Project 1',
        platform: 'javascript',
      }),
    ];
    ProjectsStore.loadInitialData(projects);
  });

  afterAll(() => {
    jest.restoreAllMocks();
    resetMockDate();
    ProjectsStore.reset();
  });

  it('renders span.op', () => {
    render(
      <FieldRenderer
        column={eventView.getColumns()[3]}
        data={mockedEventData}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('test_op')).toBeInTheDocument();
  });

  it('renders span id link to traceview', () => {
    render(
      <FieldRenderer
        column={eventView.getColumns()[0]}
        data={mockedEventData}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('spanId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/traces/trace/traceId/?node=span-spanId&node=txn-transactionSpanId&source=traces&statsPeriod=14d&targetId=transactionSpanId&timestamp=1727964900`
    );
  });

  it('renders transaction id link to traceview', () => {
    render(
      <FieldRenderer
        column={eventView.getColumns()[4]}
        data={mockedEventData}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('transactionId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/traces/trace/traceId/?source=traces&statsPeriod=14d&targetId=transactionSpanId&timestamp=1727964900`
    );
  });

  it('renders trace id link to traceview', () => {
    render(
      <FieldRenderer
        column={eventView.getColumns()[2]}
        data={mockedEventData}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('traceId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/explore/traces/trace/traceId/?source=traces&statsPeriod=14d&timestamp=1727964900`
    );
  });

  it('renders timestamp', () => {
    render(
      <FieldRenderer
        column={eventView.getColumns()[1]}
        data={mockedEventData}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByRole('time')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });

  describe('without otel friendly UI flag', () => {
    const organizationWithoutFlags = OrganizationFixture({
      features: [],
    });

    it('renders description with project badge', () => {
      render(
        <FieldRenderer
          column={eventView.getColumns()[5]}
          data={mockedEventData}
          meta={{}}
        />,
        {organization: organizationWithoutFlags}
      );
      expect(screen.getByTestId('platform-icon-javascript')).toBeInTheDocument();
    });

    it('renders name without project badge', () => {
      render(
        <FieldRenderer
          column={eventView.getColumns()[6]}
          data={mockedEventData}
          meta={{}}
        />,
        {organization: organizationWithoutFlags}
      );
      expect(screen.queryByTestId('platform-icon-javascript')).not.toBeInTheDocument();
    });
  });

  describe('with otel friendly UI flag', () => {
    const organizationWithOtelFlag = OrganizationFixture({
      features: ['performance-otel-friendly-ui'],
    });

    it('renders description without project badge', () => {
      render(
        <FieldRenderer
          column={eventView.getColumns()[5]}
          data={mockedEventData}
          meta={{}}
        />,
        {organization: organizationWithOtelFlag}
      );
      expect(screen.queryByTestId('platform-icon-javascript')).not.toBeInTheDocument();
    });

    it('renders name with project badge', () => {
      render(
        <FieldRenderer
          column={eventView.getColumns()[6]}
          data={mockedEventData}
          meta={{}}
        />,
        {organization: organizationWithOtelFlag}
      );
      expect(screen.getByTestId('platform-icon-javascript')).toBeInTheDocument();
    });
  });
});
