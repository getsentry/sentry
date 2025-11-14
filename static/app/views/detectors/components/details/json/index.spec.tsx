import {DetectorFixture} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {JsonSchemaDetectorDetails} from 'sentry/views/detectors/components/details/json';

describe('JsonSchemaDetectorDetails', () => {
  const detector = DetectorFixture({
    id: '1',
    type: 'performance_slow_db_query',
    name: 'Slow DB Query Detector',
    projectId: '1',
    config: {
      durationThreshold: 2000,
      allowedSpanOps: ['db', 'db.query'],
    },
    description: 'Detects slow database queries',
    enabled: true,
  });

  const project = ProjectFixture({id: '1', slug: 'project-slug'});

  const defaultProps = {
    detector,
    project,
  };

  const detectorTypeSchema = {
    performance_slow_db_query: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      description: 'Detects slow database queries exceeding duration threshold',
      type: 'object',
      properties: {
        duration_threshold: {
          type: 'integer',
          description: 'Duration threshold in milliseconds for detecting slow queries',
          minimum: 100,
          maximum: 10000,
          default: 1000,
        },
        allowed_span_ops: {
          type: 'array',
          description: 'List of span operation types to monitor (e.g., "db", "db.query")',
          items: {type: 'string'},
          default: ['db'],
        },
      },
      required: ['duration_threshold', 'allowed_span_ops'],
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detector-types/',
      method: 'GET',
      body: detectorTypeSchema,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=1&query=is%3Aunresolved%20detector%3A1&statsPeriod=14d',
      method: 'GET',
      body: [GroupFixture()],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/1/',
      method: 'GET',
      body: UserFixture(),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: GroupFixture(),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/`,
      body: [],
    });
  });

  it('displays the detector name and description', async () => {
    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    expect(await screen.findByText('Slow DB Query Detector')).toBeInTheDocument();
    expect(screen.getByText('Detects slow database queries')).toBeInTheDocument();
  });

  it('displays the schema description when available', async () => {
    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    expect(
      await screen.findByText(
        'Detects slow database queries exceeding duration threshold'
      )
    ).toBeInTheDocument();
  });

  it('displays configuration values from the detector', async () => {
    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    // Wait for schema to load
    await screen.findByText('Detects slow database queries exceeding duration threshold');

    // Check that configuration section is displayed
    expect(screen.getByText('Configuration')).toBeInTheDocument();

    // Check that duration threshold is displayed
    expect(screen.getByText('Duration Threshold')).toBeInTheDocument();
    expect(
      screen.getByText('Duration threshold in milliseconds for detecting slow queries')
    ).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();

    // Check that allowed span ops is displayed
    expect(screen.getByText('Allowed Span Ops')).toBeInTheDocument();
    expect(
      screen.getByText('List of span operation types to monitor (e.g., "db", "db.query")')
    ).toBeInTheDocument();
    expect(screen.getByText('db, db.query')).toBeInTheDocument();
  });

  it('displays required field indicator for required fields', async () => {
    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    await screen.findByText('Detects slow database queries exceeding duration threshold');

    // Both fields are required, so both should have the asterisk
    const durationThreshold = screen.getByText('Duration Threshold');
    expect(durationThreshold.parentElement?.textContent).toContain('*');

    const allowedSpanOps = screen.getByText('Allowed Span Ops');
    expect(allowedSpanOps.parentElement?.textContent).toContain('*');
  });

  it('handles missing config values gracefully', async () => {
    const detectorWithoutConfig = DetectorFixture({
      ...detector,
      config: {},
    });

    render(
      <JsonSchemaDetectorDetails detector={detectorWithoutConfig} project={project} />
    );

    await screen.findByText('Detects slow database queries exceeding duration threshold');

    // Configuration section should still be displayed
    expect(screen.getByText('Configuration')).toBeInTheDocument();

    // Values should show as "-" when missing
    const durationThreshold = screen.getByText('Duration Threshold');
    expect(durationThreshold.parentElement?.textContent).toContain('-');
  });

  it('displays array values as comma-separated strings', async () => {
    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    await screen.findByText('Detects slow database queries exceeding duration threshold');

    // Array values should be displayed as comma-separated strings
    expect(screen.getByText('db, db.query')).toBeInTheDocument();
  });

  it('does not display schema description section when description is missing', async () => {
    const schemaWithoutDescription = {
      performance_slow_db_query: {
        ...detectorTypeSchema.performance_slow_db_query,
        description: undefined,
      },
    };

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detector-types/',
      method: 'GET',
      body: schemaWithoutDescription,
    });

    render(<JsonSchemaDetectorDetails {...defaultProps} />);

    await screen.findByText('Configuration');

    // About section should not be displayed when description is missing
    expect(screen.queryByText('About')).not.toBeInTheDocument();
  });
});
