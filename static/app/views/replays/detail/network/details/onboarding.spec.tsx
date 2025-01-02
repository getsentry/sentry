import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import hydrateSpans from 'sentry/utils/replays/hydrateSpans';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import {Output} from 'sentry/views/replays/detail/network/details/getOutputType';

jest.mock('sentry/utils/useProjectSdkNeedsUpdate');

import {Setup} from 'sentry/views/replays/detail/network/details/onboarding';

const [MOCK_ITEM] = hydrateSpans(ReplayRecordFixture(), [
  ReplayRequestFrameFixture({
    op: 'resource.fetch',
    startTimestamp: new Date(),
    endTimestamp: new Date(),
    description: '/api/0/issues/1234',
  }),
]);

describe('Setup', () => {
  jest
    .mocked(useProjectSdkNeedsUpdate)
    .mockReturnValue({isError: false, isFetching: false, needsUpdate: false});

  describe('Setup is not complete', () => {
    it('should render the full snippet when no setup is done yet', () => {
      const {container} = render(
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

      expect(container.querySelector('code')).toHaveTextContent(
        `networkRequestHeaders: ['X-Custom-Header'],`
      );
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
});
