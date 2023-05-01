import {render, screen} from 'sentry-test/reactTestingLibrary';

import NetworkDetailsContent from 'sentry/views/replays/detail/network/details/content';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

function mockSectionProps(item) {
  return {
    item: item || {},
    onScrollToRow: () => {},
    projectId: '',
    startTimestampMs: new Date('2023-12-24').getTime(),
  };
}

describe('NetworkDetailsContent', () => {
  describe('Details Tab', () => {
    const visibleTab = 'details' as TabKey;

    const mockItem = {};

    it('should render something', () => {
      render(
        <NetworkDetailsContent
          isSetup={false}
          visibleTab={visibleTab}
          {...mockSectionProps(mockItem)}
        />
      );

      expect(screen.getByText('foo')).toBeInTheDocument();
    });
  });

  describe('Request Tab', () => {
    const visibleTab = 'request' as TabKey;

    //
  });

  describe('Response Tab', () => {
    const visibleTab = 'response' as TabKey;

    //
  });
});
