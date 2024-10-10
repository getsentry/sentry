import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {FieldRenderer} from './fieldRenderer';

const mockedEventData = {
  id: 'spanId',
  timestamp: '2024-10-03T10:15:00',
  trace: 'traceId',
  'span.op': 'test_op',
  'transaction.id': 'transactionId',
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
        column={eventView.getColumns()[3]}
        data={mockedEventData}
        dataset={DiscoverDatasets.SPANS_INDEXED}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('test_op')).toBeInTheDocument();
  });

  it('renders span id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[0]}
        data={mockedEventData}
        dataset={DiscoverDatasets.SPANS_INDEXED}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('spanId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/performance/trace/traceId/?eventId=transactionId&node=span-spanId&node=txn-transactionId&source=traces&statsPeriod=14d&timestamp=1727964900`
    );
  });

  it('renders transaction id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[4]}
        data={mockedEventData}
        dataset={DiscoverDatasets.SPANS_INDEXED}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByText('transactionId')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      `/organizations/org-slug/performance/trace/traceId/?eventId=transactionId&source=traces&statsPeriod=14d&timestamp=1727964900`
    );
  });

  it('renders trace id link to traceview', function () {
    render(
      <FieldRenderer
        column={eventView.getColumns()[2]}
        data={mockedEventData}
        dataset={DiscoverDatasets.SPANS_INDEXED}
        meta={{}}
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
        column={eventView.getColumns()[1]}
        data={mockedEventData}
        dataset={DiscoverDatasets.SPANS_INDEXED}
        meta={{}}
      />,
      {organization}
    );

    expect(screen.getByRole('time')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
  });
});
