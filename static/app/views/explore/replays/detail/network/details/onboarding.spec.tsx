import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';
import {Setup} from 'sentry/views/explore/replays/detail/network/details/onboarding';
import {Output} from 'sentry/views/explore/replays/detail/network/details/output';

jest.mock('sentry/utils/useProjectSdkNeedsUpdate');
jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');

const [MOCK_ITEM] = hydrateSpans(ReplayRecordFixture(), [
  ReplayRequestFrameFixture({
    op: 'resource.fetch',
    startTimestamp: new Date(),
    endTimestamp: new Date(),
    description: '/api/0/organizations/1/issues/1234',
  }),
]);

describe('Setup', () => {
  jest.mocked(useProjectSdkNeedsUpdate).mockReturnValue({
    isError: false,
    isFetching: false,
    needsUpdate: false,
    data: [],
  });

  beforeEach(() => {
    jest.mocked(useReplayReader).mockReturnValue(null);
  });

  describe('Setup is not complete', () => {
    it('should render the full snippet when no setup is done yet', () => {
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.SETUP}
          visibleTab="details"
        />
      );

      expect(
        screen.getByText('Capture Request and Response Headers and Bodies')
      ).toBeInTheDocument();

      const expectedSnippet = [
        'Sentry.init({',
        '  integrations: [',
        '    Sentry.replayIntegration({',
        "      networkDetailAllowUrls: ['/api/0/organizations/1/issues/1234'],",
        "      networkRequestHeaders: ['X-Custom-Header'],",
        "      networkResponseHeaders: ['X-Custom-Header'],",
        '    }),',
        '  ],',
        '})',
      ].join('\n');
      const snippetElem = screen.getByText(
        "networkRequestHeaders: ['X-Custom-Header'],",
        {exact: false}
      );
      // Using toHaveTextContent would be nice here, but it loses the newlines.
      expect(snippetElem.innerHTML).toBe(expectedSnippet);
    });
  });

  describe('Url is skipped', () => {
    it('should render a note on the Details tab to allow this url', () => {
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.URL_SKIPPED}
          visibleTab="details"
        />
      );

      expect(
        screen.getByText('Capture Request and Response Headers')
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Add the following to your networkDetailAllowUrls list to start capturing data:'
          )
        )
      ).toBeInTheDocument();
    });

    it('should render a note on the Requst & Response tabs to allow this url and enable capturing bodies', () => {
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.URL_SKIPPED}
          visibleTab="request"
        />
      );

      expect(screen.getByText('Capture Request and Response Bodies')).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Add the following to your networkDetailAllowUrls list to start capturing data:'
          )
        )
      ).toBeInTheDocument();
    });
  });

  describe('Body is skipped', () => {
    it('should render a note on the Requst & Response tabs to enable capturing bodies', () => {
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.BODY_SKIPPED}
          visibleTab="request"
        />
      );

      expect(screen.getByText('Capture Request and Response Bodies')).toBeInTheDocument();

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Enable networkCaptureBodies: true to capture both Request and Response bodies.'
          )
        )
      ).toBeInTheDocument();
    });
  });

  describe('Showing the data', () => {
    it('should render a short message reminding you to configure custom headers', () => {
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.DATA}
          visibleTab="details"
        />
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'You can capture additional headers by adding them to the networkRequestHeaders and networkResponseHeaders lists in your SDK config.'
          )
        )
      ).toBeInTheDocument();
    });
  });

  describe('Mobile (video) replay with supported SDK', () => {
    function mockVideoReplay(sdkName: string) {
      jest.mocked(useReplayReader).mockReturnValue({
        isVideoReplay: () => true,
        getReplay: () => ({sdk: {name: sdkName}}) as any,
      } as any);
    }

    it.each([
      {
        sdk: 'sentry.java.android',
        platform: 'Android',
        snippetMatch: 'SentryAndroid.init',
      },
      {sdk: 'sentry.cocoa', platform: 'iOS', snippetMatch: 'SentrySDK.start'},
      {
        sdk: 'sentry.javascript.react-native',
        platform: 'React Native',
        snippetMatch: 'mobileReplayIntegration',
      },
    ])(
      'should render setup instructions with $platform code snippet when not configured',
      ({sdk, snippetMatch}) => {
        mockVideoReplay(sdk);
        render(
          <Setup
            item={MOCK_ITEM!}
            projectId="0"
            showSnippet={Output.SETUP}
            visibleTab="details"
          />
        );

        expect(
          screen.getByText('Capture Request and Response Headers and Bodies')
        ).toBeInTheDocument();
        expect(screen.getByRole('link', {name: 'Learn More'})).toBeInTheDocument();
        expect(screen.getByText(snippetMatch, {exact: false})).toBeInTheDocument();
        expect(
          screen.getByText(
            textWithMarkupMatcher(
              'Add the following to your networkDetailAllowUrls list to start capturing data:'
            )
          )
        ).toBeInTheDocument();
      }
    );

    it('should render URL skipped message for mobile replays', () => {
      mockVideoReplay('sentry.java.android');
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.URL_SKIPPED}
          visibleTab="request"
        />
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Add the following to your networkDetailAllowUrls list to start capturing data:'
          )
        )
      ).toBeInTheDocument();
    });

    it('should render body skipped message for mobile replays', () => {
      mockVideoReplay('sentry.cocoa');
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.BODY_SKIPPED}
          visibleTab="request"
        />
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Enable networkCaptureBodies: true to capture both Request and Response bodies.'
          )
        )
      ).toBeInTheDocument();
    });

    it('should render additional headers hint with docs link for mobile replays', () => {
      mockVideoReplay('sentry.java.android');
      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.DATA}
          visibleTab="details"
        />
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'You can capture additional headers by adding them to the networkRequestHeaders and networkResponseHeaders lists in your SDK config. Learn More.'
          )
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Learn More'})).toHaveAttribute(
        'href',
        expect.stringContaining('docs.sentry.io/platforms/android')
      );
    });
  });

  describe('Mobile (video) replay with unsupported SDK', () => {
    it('should render the not available message for Flutter replays', () => {
      jest.mocked(useReplayReader).mockReturnValue({
        isVideoReplay: () => true,
        getReplay: () => ({sdk: {name: 'sentry.dart.flutter'}}) as any,
      } as any);

      render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.SETUP}
          visibleTab="request"
        />
      );

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Request and response headers or bodies are currently not available for this platform.'
          )
        )
      ).toBeInTheDocument();
    });

    it('should render nothing on details tab for unsupported mobile SDK', () => {
      jest.mocked(useReplayReader).mockReturnValue({
        isVideoReplay: () => true,
        getReplay: () => ({sdk: {name: 'sentry.dart.flutter'}}) as any,
      } as any);

      const {container} = render(
        <Setup
          item={MOCK_ITEM!}
          projectId="0"
          showSnippet={Output.SETUP}
          visibleTab="details"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
