import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  docUrls,
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

describe('EventProcessingErrors', function () {
  it.each(['release', 'environment'])(
    'renders error card with documentation tooltip for known error type: %s',
    async function (fieldName) {
      const mockErrors: ErrorMessage[] = [
        {
          title: 'Discarded invalid value',
          desc: null,
          data: {
            name: fieldName,
            value: 'something/invalid',
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
      expect(screen.getByText(fieldName)).toBeInTheDocument();

      await userEvent.hover(screen.getByTestId('more-information'));

      expect(
        await screen.findByText(
          textWithMarkupMatcher(/learn more about this error in our documentation/i)
        )
      ).toBeInTheDocument();

      expect(screen.getByRole('link')).toHaveAttribute('href', docUrls[fieldName]);
    }
  );

  it('renders error card without documentation tooltip for unknown error types', function () {
    const mockErrors: ErrorMessage[] = [
      {
        title: 'Discarded invalid value',
        desc: null,
        data: {
          unknown_field: 'some-value',
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
    expect(screen.getByText('some-value')).toBeInTheDocument();
    expect(screen.queryByTestId('more-information')).not.toBeInTheDocument();
  });
});
