import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

import {FieldRenderer} from './fieldRenderer';

const mockedEventData = {
  id: 'spanId',
  timestamp: '2024-10-03T10:15:00',
  trace: 'traceId',
  'span.op': 'test_op',
  'transaction.id': 'transactionId',
  'transaction.span_id': 'transactionSpanId',
};

describe('FieldRenderer tests', function () {
  const organization = OrganizationFixture({
    features: ['trace-view-v1'],
  });

  const location: Location = LocationFixture({
    query: {
      id: '42',
      name: 'best query',
      field: ['id', 'timestamp', 'trace', 'span.op', 'transaction.id'],
    },
  });

  const eventView = EventView.fromLocation(location);

  beforeAll(() => {
    const mockTimestamp = new Date('2024-10-06T00:00:00').getTime();
    jest.spyOn(global.Date, 'now').mockImplementation(() => mockTimestamp);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('renders span.op', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[3]!}
        data={mockedEventData}
        meta={{}}
        mode={Mode.SAMPLES}
      />,
      {organization}
    );

    expect(screen.getByText('test_op')).toBeInTheDocument();
  });

  it('renders span id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[0]!}
        data={mockedEventData}
        meta={{}}
        mode={Mode.SAMPLES}
      />,
      {organization}
    );

    expect(screen.getByText('spanId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/performance/trace/traceId/?node=span-spanId&node=txn-transactionSpanId&source=traces&statsPeriod=14d&targetId=transactionSpanId&timestamp=1727964900`
    );
  });

  it('renders transaction id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[4]!}
        data={mockedEventData}
        meta={{}}
        mode={Mode.SAMPLES}
      />,
      {organization}
    );

    expect(screen.getByText('transactionId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/performance/trace/traceId/?source=traces&statsPeriod=14d&targetId=transactionSpanId&timestamp=1727964900`
    );
  });

  it('renders trace id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[2]!}
        data={mockedEventData}
        meta={{}}
        mode={Mode.SAMPLES}
      />,
      {organization}
    );

    expect(screen.getByText('traceId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/performance/trace/traceId/?source=traces&statsPeriod=14d&timestamp=1727964900`
    );
  });

  it('renders timestamp', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[1]!}
        data={mockedEventData}
        meta={{}}
        mode={Mode.SAMPLES}
      />,
      {organization}
    );

    expect(screen.getByRole('time')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });
});
