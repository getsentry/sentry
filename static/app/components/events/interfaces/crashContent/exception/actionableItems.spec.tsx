import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';
import {EntryType} from 'sentry/types/event';

describe('Actionable Items', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const url = `/projects/${organization.slug}/${project.slug}/events/1/actionable-items/`;

  const defaultProps = {
    project: ProjectFixture(),
    event: EventFixture(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('does not render anything when no errors', () => {
    MockApiClient.addMockResponse({
      url,
      body: {
        errors: [],
      },
      method: 'GET',
    });

    const {container} = render(<ActionableItems {...defaultProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with errors in event', async () => {
    const eventErrors = [
      {
        type: 'invalid_data',
        data: {
          name: 'logentry',
        },
        message: 'no message present',
      },
      {
        type: 'invalid_data',
        data: {
          name: 'breadcrumbs.values.2.data',
        },
        message: 'expected an object',
      },
    ];

    MockApiClient.addMockResponse({
      url,
      body: {
        errors: eventErrors,
      },
      method: 'GET',
    });

    const eventWithErrors = EventFixture({
      errors: eventErrors,
    });

    render(<ActionableItems {...defaultProps} event={eventWithErrors} />);

    expect(await screen.findByText('Discarded invalid value (2)')).toBeInTheDocument();
    expect(await screen.findByText('Expand')).toBeInTheDocument();
  });

  it('does not render hidden cocoa errors', async () => {
    const eventErrors = [
      {
        type: 'invalid_attribute',
        data: {
          name: 'logentry',
        },
        message: 'no message present',
      },
      {
        type: 'invalid_data',
        data: {
          name: 'contexts.trace.sampled',
        },
        message: 'expected an object',
      },
    ];

    MockApiClient.addMockResponse({
      url,
      body: {
        errors: eventErrors,
      },
      method: 'GET',
    });

    const eventWithErrors = EventFixture({
      errors: eventErrors,
      sdk: {
        name: 'sentry.cocoa',
        version: '8.7.3',
      },
    });

    render(<ActionableItems {...defaultProps} event={eventWithErrors} />);

    expect(
      await screen.findByText('Discarded unknown attribute (1)')
    ).toBeInTheDocument();
    expect(await screen.findByText('Expand')).toBeInTheDocument();
  });

  it('does not render hidden flutter web errors', async () => {
    const eventErrors = [
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source: 'my_app/main.dart',
        },
      },
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source:
            'http://localhost:64053/Documents/flutter/packages/flutter/lib/src/material/ink_well.dart',
        },
      },
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source:
            'org-dartlang-sdk:///dart-sdk/lib/_internal/js_runtime/lib/async_patch.dart',
        },
      },
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source:
            'org-dartlang-sdk:///dart-sdk/lib/_internal/js_runtime/lib/js_helper.dart',
        },
      },
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source: 'org-dartlang-sdk:///dart-sdk/lib/async/future_impl.dart',
        },
      },
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        data: {
          source: 'org-dartlang-sdk:///dart-sdk/lib/async/zone.dart',
        },
      },
    ];

    MockApiClient.addMockResponse({
      url,
      body: {
        errors: eventErrors,
      },
      method: 'GET',
    });

    const eventWithErrors = EventFixture({
      errors: eventErrors,
      sdk: {
        name: 'sentry.dart.flutter',
      },
    });

    render(<ActionableItems {...defaultProps} event={eventWithErrors} />);

    expect(await screen.findByText('Missing Sources Context (1)')).toBeInTheDocument();
    expect(await screen.findByText('Expand')).toBeInTheDocument();
  });

  it('handles unknown flutter source', async () => {
    const eventErrors = [
      {
        type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
        // Missing Source key
        data: {},
      },
    ];

    MockApiClient.addMockResponse({
      url,
      body: {
        errors: eventErrors,
      },
      method: 'GET',
    });

    const eventWithErrors = EventFixture({
      errors: eventErrors,
      sdk: {
        name: 'sentry.dart.flutter',
      },
    });

    render(<ActionableItems {...defaultProps} event={eventWithErrors} />);

    expect(await screen.findByText('Missing Sources Context (1)')).toBeInTheDocument();
    expect(await screen.findByText('Expand')).toBeInTheDocument();
  });

  it('displays missing mapping file', async () => {
    const eventError = [
      {
        type: 'proguard_missing_mapping',
        message: 'A proguard mapping file was missing.',
        data: {mapping_uuid: 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7'},
      },
    ];
    const eventWithDebugMeta = EventFixture({
      platform: 'java',
      entries: [
        {
          type: EntryType.DEBUGMETA,
          data: {
            images: [{type: 'proguard', uuid: 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7'}],
          },
        },
      ],
      errors: eventError,
    });

    MockApiClient.addMockResponse({
      url,
      body: {
        errors: eventError,
      },
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/files/dsyms/`,
      body: [],
    });

    render(<ActionableItems {...defaultProps} event={eventWithDebugMeta} />);

    expect(
      await screen.findByText('A proguard mapping file was missing (1)')
    ).toBeInTheDocument();
    expect(await screen.findByText('Expand')).toBeInTheDocument();
  });
});
