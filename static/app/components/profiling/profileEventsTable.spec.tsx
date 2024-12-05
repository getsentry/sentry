import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import ProjectsStore from 'sentry/stores/projectsStore';
import {FieldValueType} from 'sentry/utils/fields';
import type {EventsResults} from 'sentry/utils/profiling/hooks/types';

function customEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

const project = ProjectFixture({
  id: '1',
  slug: 'foo',
});

describe('ProfileEventsTable', function () {
  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);
  });

  it('renders loading', function () {
    const {organization, router} = initializeOrg();

    const columns = ['count()' as const];
    const sort = {
      key: 'count()' as const,
      order: 'desc' as const,
    };

    render(
      <ProfileEventsTable
        columns={columns}
        data={null}
        error={null}
        isLoading
        sort={sort}
      />,
      {router, organization}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders error', function () {
    const {organization, router} = initializeOrg();

    const columns = ['count()' as const];
    const sort = {
      key: 'count()' as const,
      order: 'desc' as const,
    };

    render(
      <ProfileEventsTable
        columns={columns}
        data={null}
        error="error"
        isLoading={false}
        sort={sort}
      />,
      {router, organization}
    );

    expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
  });

  it('renders asc sort links on the header', function () {
    const {organization, router} = initializeOrg();

    const columns = ['count()' as const];
    const sort = {
      key: 'count()' as const,
      order: 'desc' as const,
    };

    render(
      <ProfileEventsTable
        columns={columns}
        data={null}
        error={null}
        isLoading
        sort={sort}
        sortableColumns={new Set(columns)}
      />,
      {router, organization}
    );

    const link = screen.getByRole('link', {name: 'Count()'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `/mock-pathname/?sort=${customEncodeURIComponent('count()')}`
    );
  });

  it('renders desc sort links on the header', function () {
    const {organization, router} = initializeOrg();

    const columns = ['count()' as const];
    const sort = {
      key: 'count()' as const,
      order: 'asc' as const,
    };

    render(
      <ProfileEventsTable
        columns={columns}
        data={null}
        error={null}
        isLoading
        sort={sort}
        sortableColumns={new Set(columns)}
      />,
      {router, organization}
    );

    const link = screen.getByRole('link', {name: 'Count()'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `/mock-pathname/?sort=${customEncodeURIComponent('-count()')}`
    );
  });

  it('renders formatted values', function () {
    const {organization, router} = initializeOrg();

    const columns = [
      'id',
      'project',
      'transaction',
      'release',
      'timestamp',
      'profile.duration',
      'count()',
    ] as const;

    const data: EventsResults<(typeof columns)[number]> = {
      data: [
        {
          id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          project: 'foo',
          transaction: 'bar',
          release: 'baz@1.0.0+aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          timestamp: '2022-11-01T00:00:00+00:00',
          'profile.duration': 100000000,
          'count()': 123,
        },
      ],
      meta: {
        fields: {
          id: FieldValueType.STRING,
          project: FieldValueType.STRING,
          transaction: FieldValueType.STRING,
          release: FieldValueType.STRING,
          timestamp: FieldValueType.DATE,
          'profile.duration': FieldValueType.DURATION,
          'count()': FieldValueType.INTEGER,
        },
        units: {
          id: null,
          project: null,
          transaction: null,
          release: null,
          timestamp: null,
          'profile.duration': 'nanosecond',
          'count()': null,
        },
      },
    };

    const sort = {
      key: 'transaction' as const,
      order: 'asc' as const,
    };

    render(
      <ProfileEventsTable
        columns={columns.slice()}
        data={data}
        error={null}
        isLoading={false}
        sort={sort}
        sortableColumns={new Set(columns)}
      />,
      {router, organization}
    );

    // id
    expect(screen.getByRole('cell', {name: 'aaaaaaaa'})).toBeInTheDocument();

    // project
    expect(screen.getByRole('cell', {name: 'View Project Details'})).toBeInTheDocument();

    // the transaction is both a cell and a link
    expect(screen.getByRole('link', {name: 'bar'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'bar'})).toBeInTheDocument();

    // release
    expect(screen.getByRole('cell', {name: '1.0.0 (aaaaaaaaaaaa)'})).toBeInTheDocument();

    // timestamp
    expect(
      screen.getByRole('cell', {name: 'Nov 1, 2022 12:00:00 AM UTC'})
    ).toBeInTheDocument();

    // profile.duration
    expect(screen.getByRole('cell', {name: '100.00ms'})).toBeInTheDocument();

    // count()
    expect(screen.getByRole('cell', {name: '123'})).toBeInTheDocument();
  });
});
