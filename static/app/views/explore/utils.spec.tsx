import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import {viewSamplesTarget} from 'sentry/views/explore/utils';

describe('viewSamplesTarget', function () {
  const project = ProjectFixture();
  const extras = {projects: [project]};

  it('simple drill down with no group bys', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(location, '', [], {}, extras);
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: '',
      },
    });
  });

  it('simple drill down with single group by', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(
      location,
      '',
      ['foo'],
      {foo: 'foo', 'count()': 10},
      extras
    );
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: 'foo:foo',
      },
    });
  });

  it('simple drill down with multiple group bys', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(
      location,
      '',
      ['foo', 'bar', 'baz'],
      {
        foo: 'foo',
        bar: 'bar',
        baz: 'baz',
        'count()': 10,
      },
      extras
    );
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: 'foo:foo bar:bar baz:baz',
      },
    });
  });

  it('simple drill down with on environment', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(
      location,
      '',
      ['environment'],
      {
        environment: 'prod',
        'count()': 10,
      },
      extras
    );
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: '',
        environment: 'prod',
      },
    });
  });

  it('simple drill down with on project id', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(
      location,
      '',
      ['project.id'],
      {
        'project.id': 1,
        'count()': 10,
      },
      extras
    );
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: '',
        project: '1',
      },
    });
  });

  it('simple drill down with on project slug', function () {
    const location = LocationFixture();
    const target = viewSamplesTarget(
      location,
      '',
      ['project'],
      {
        project: project.slug,
        'count()': 10,
      },
      extras
    );
    expect(target).toMatchObject({
      query: {
        mode: 'samples',
        query: '',
        project: String(project.id),
      },
    });
  });
});
