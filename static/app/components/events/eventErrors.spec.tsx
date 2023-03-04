import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {EventErrors} from 'sentry/components/events/eventErrors';
import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';
import {EntryType} from 'sentry/types';

describe('EventErrors', () => {
  const defaultProps = {
    project: TestStubs.Project(),
    event: TestStubs.Event(),
    isShare: false,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('does not render anything when no errors', async () => {
    const {container} = render(<EventErrors {...defaultProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders with errors in event', async () => {
    const eventWithErrors = TestStubs.Event({
      errors: [
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
      ],
    });

    render(<EventErrors {...defaultProps} event={eventWithErrors} />);

    await userEvent.click(screen.getByText(/there were 2 problems processing this event/i));
    const errorItems = screen.getAllByTestId('event-error-item');
    expect(errorItems).toHaveLength(2);
    expect(within(errorItems[0]).getByText('logentry')).toBeInTheDocument();
    expect(
      within(errorItems[1]).getByText('breadcrumbs.values.2.data')
    ).toBeInTheDocument();
  });

  describe('release artifacts', () => {
    it('displays extra error info when event dist does not match file dist', async () => {
      const mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/releases/release-version/files/',
        body: [{name: 'dist-1'}],
      });

      const eventWithDifferentDist = TestStubs.Event({
        release: {
          version: 'release-version',
        },
        errors: [
          {
            type: JavascriptProcessingErrors.JS_MISSING_SOURCE,
            data: {
              url: 'https://place.com/dist-2',
            },
          },
        ],
      });

      render(<EventErrors {...defaultProps} event={eventWithDifferentDist} />);

      await userEvent.click(screen.getByText(/there was 1 problem processing this event/i));

      expect(mock).toHaveBeenCalled();
      await screen.findByText(
        /Source code was not found because the distribution did not match/i
      );
    });
  });

  describe('proguard errors', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/files/dsyms/`,
        body: [],
      });
    });

    const proGuardUuid = 'a59c8fcc-2f27-49f8-af9e-02661fc3e8d7';

    it('displays missing mapping file with debugmeta but no event error', async () => {
      const eventWithDebugMeta = TestStubs.Event({
        platform: 'java',
        entries: [
          {
            type: EntryType.DEBUGMETA,
            data: {
              images: [{type: 'proguard', uuid: proGuardUuid}],
            },
          },
        ],
      });

      render(<EventErrors {...defaultProps} event={eventWithDebugMeta} />);

      await userEvent.click(
        await screen.findByText(/there was 1 problem processing this event/i)
      );
      const errorItem = screen.getByTestId('event-error-item');
      expect(errorItem).toBeInTheDocument();
      expect(
        within(errorItem).getByText('A proguard mapping file was missing.')
      ).toBeInTheDocument();
    });

    it('displays missing mapping file with debugmeta and matching event error', async () => {
      const eventWithDebugMeta = TestStubs.Event({
        platform: 'java',
        entries: [
          {
            type: EntryType.DEBUGMETA,
            data: {
              images: [{type: 'proguard', uuid: proGuardUuid}],
            },
          },
        ],
        errors: [
          {
            type: 'proguard_missing_mapping',
            message: 'A proguard mapping file was missing.',
            data: {mapping_uuid: proGuardUuid},
          },
        ],
      });

      render(<EventErrors {...defaultProps} event={eventWithDebugMeta} />);

      await userEvent.click(
        await screen.findByText(/there was 1 problem processing this event/i)
      );
      const errorItem = screen.getByTestId('event-error-item');
      expect(errorItem).toBeInTheDocument();
      expect(
        within(errorItem).getByText('A proguard mapping file was missing.')
      ).toBeInTheDocument();
    });

    describe('ProGuard Plugin seems to not be correctly configured', function () {
      it('find minified data in the exception entry', async function () {
        const newEvent = TestStubs.Event({
          platform: 'java',
          entries: [
            {
              type: 'exception',
              data: {
                values: [
                  {
                    stacktrace: {
                      frames: [
                        {
                          function: null,
                          colNo: null,
                          vars: {},
                          symbol: null,
                          module: 'a.$a.a.a',
                        },
                      ],
                      framesOmitted: null,
                      registers: null,
                      hasSystemFrames: false,
                    },
                    module: null,
                    rawStacktrace: null,
                    mechanism: null,
                    threadId: null,
                    value: 'Unexpected token else',
                    type: 'SyntaxError',
                  },
                ],
                excOmitted: null,
                hasSystemFrames: false,
              },
            },
          ],
        });

        render(<EventErrors {...defaultProps} event={newEvent} />);

        await userEvent.click(
          await screen.findByText(/there was 1 problem processing this event/i)
        );
        const errorItem = screen.getByTestId('event-error-item');
        expect(errorItem).toBeInTheDocument();
        expect(
          within(errorItem).getByText(
            textWithMarkupMatcher(
              'Some frames appear to be minified. Did you configure the Sentry Gradle Plugin?'
            )
          )
        ).toBeInTheDocument();
      });

      it('find minified data in the threads entry', async function () {
        const newEvent = TestStubs.Event({
          platform: 'java',
          entries: [
            {
              type: 'exception',
              data: {
                values: [
                  {
                    stacktrace: {
                      frames: [
                        {
                          function: null,
                          colNo: null,
                          vars: {},
                          symbol: null,
                          module: 'a.$a.a.a',
                        },
                      ],
                      framesOmitted: null,
                      registers: null,
                      hasSystemFrames: false,
                    },
                    module: null,
                    rawStacktrace: null,
                    mechanism: null,
                    threadId: null,
                    value: 'Unexpected token else',
                    type: 'SyntaxError',
                  },
                ],
                excOmitted: null,
                hasSystemFrames: false,
              },
            },
            {
              type: 'threads',
              data: {
                values: [
                  {
                    stacktrace: {
                      frames: [
                        {
                          function: 'start',
                          package: 'libdyld.dylib',
                          module: 'a.$a.a.a',
                        },
                        {
                          function: 'main',
                          package: 'iOS-Swift',
                          module: '',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        });

        render(<EventErrors {...defaultProps} event={newEvent} />);

        await userEvent.click(
          await screen.findByText(/there was 1 problem processing this event/i)
        );
        const errorItem = screen.getByTestId('event-error-item');
        expect(errorItem).toBeInTheDocument();
        expect(
          within(errorItem).getByText(
            textWithMarkupMatcher(
              'Some frames appear to be minified. Did you configure the Sentry Gradle Plugin?'
            )
          )
        ).toBeInTheDocument();
      });
    });
  });
});
