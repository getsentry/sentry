import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DOCS_URLS,
  EventProcessingErrors,
} from 'sentry/components/events/eventProcessingErrors';
import type {ErrorMessage} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';

jest.mock(
  'sentry/components/events/interfaces/crashContent/exception/useActionableItems',
  () => ({
    useActionableItemsWithProguardErrors: jest.fn(),
  })
);

const {useActionableItemsWithProguardErrors} = jest.requireMock(
  'sentry/components/events/interfaces/crashContent/exception/useActionableItems'
);

describe('EventProcessingErrors', () => {
  it.each(['release', 'environment'])(
    'renders error card with documentation tooltip for known error type: %s',
    async fieldName => {
      const mockErrors: ErrorMessage[] = [
        {
          title: 'Discarded invalid value',
          desc: null,
          data: {
            name: fieldName, // This is the correct field name from ErrorMessage interface
          },
        },
      ];

      useActionableItemsWithProguardErrors.mockReturnValue(mockErrors);

      render(
        <EventProcessingErrors
          event={EventFixture()}
          project={ProjectFixture()}
          isShare={false}
        />
      );

      expect(screen.getByText(/discarded invalid value/i)).toBeInTheDocument();

      // Check that the tooltip icon is present
      expect(screen.getByTestId('more-information')).toBeInTheDocument();

      // Hover over the tooltip to show the documentation link
      await userEvent.hover(screen.getByTestId('more-information'));

      // Wait for the tooltip content to appear and check for the link
      const tooltipLink = await screen.findByRole('link');
      expect(tooltipLink).toHaveAttribute('href', DOCS_URLS[fieldName]);
    }
  );

  it('renders error card without documentation tooltip for unknown error types', () => {
    const mockErrors: ErrorMessage[] = [
      {
        title: 'Discarded invalid value',
        desc: null,
        data: {
          name: 'unknown-error-type', // This value doesn't exist in DOCS_URLS
        },
      },
    ];

    useActionableItemsWithProguardErrors.mockReturnValue(mockErrors);

    render(
      <EventProcessingErrors
        event={EventFixture()}
        project={ProjectFixture()}
        isShare={false}
      />
    );

    expect(screen.getByText('Discarded invalid value')).toBeInTheDocument();
    expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();
  });

  it('handles non-string values gracefully', () => {
    const mockErrors: ErrorMessage[] = [
      {
        title: 'Discarded invalid value',
        desc: null,
        data: {
          name: undefined, // Test with undefined value
        },
      },
    ];

    useActionableItemsWithProguardErrors.mockReturnValue(mockErrors);

    render(
      <EventProcessingErrors
        event={EventFixture()}
        project={ProjectFixture()}
        isShare={false}
      />
    );

    expect(screen.getByText('Discarded invalid value')).toBeInTheDocument();
    expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();
  });
});
