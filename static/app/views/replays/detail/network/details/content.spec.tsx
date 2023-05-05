import {render, screen} from 'sentry-test/reactTestingLibrary';

import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import NetworkDetailsContent from 'sentry/views/replays/detail/network/details/content';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

jest.mock('sentry/utils/useProjectSdkNeedsUpdate');

const mockUseProjectSdkNeedsUpdate = useProjectSdkNeedsUpdate as jest.MockedFunction<
  typeof useProjectSdkNeedsUpdate
>;

function mockNeedsUpdate(needsUpdate: boolean) {
  mockUseProjectSdkNeedsUpdate.mockReturnValue({isFetching: false, needsUpdate});
}

const mockItems = {
  img: TestStubs.ReplaySpanPayload({
    op: 'resource.img',
    description: '/static/img/logo.png',
    data: {
      method: 'GET',
      statusCode: 200,
    },
  }),
  fetchNoDataObj: TestStubs.ReplaySpanPayload({
    op: 'resource.fetch',
    description: '/api/0/issues/1234',
  }),
  fetchUrlSkipped: TestStubs.ReplaySpanPayload({
    op: 'resource.fetch',
    description: '/api/0/issues/1234',
    data: {
      method: 'GET',
      statusCode: 200,
      request: {_meta: {warnings: ['URL_SKIPPED']}, headers: {}},
      response: {_meta: {warnings: ['URL_SKIPPED']}, headers: {}},
    },
  }),
  fetchBodySkipped: TestStubs.ReplaySpanPayload({
    op: 'resource.fetch',
    description: '/api/0/issues/1234',
    data: {
      method: 'GET',
      statusCode: 200,
      request: {
        _meta: {warnings: ['BODY_SKIPPED']},
        headers: {accept: 'application/json'},
      },
      response: {
        _meta: {warnings: ['BODY_SKIPPED']},
        headers: {'content-type': 'application/json'},
      },
    },
  }),
  fetchWithHeaders: TestStubs.ReplaySpanPayload({
    op: 'resource.fetch',
    description: '/api/0/issues/1234',
    data: {
      method: 'GET',
      statusCode: 200,
      request: {
        _meta: {},
        headers: {accept: 'application/json'},
      },
      response: {
        _meta: {},
        headers: {'content-type': 'application/json'},
      },
    },
  }),
  fetchWithRespBody: TestStubs.ReplaySpanPayload({
    op: 'resource.fetch',
    description: '/api/0/issues/1234',
    data: {
      method: 'GET',
      statusCode: 200,
      request: {
        _meta: {},
        headers: {accept: 'application/json'},
      },
      response: {
        _meta: {},
        headers: {'content-type': 'application/json'},
        body: {success: true},
      },
    },
  }),
};

function basicSectionProps() {
  return {
    onScrollToRow: () => {},
    projectId: '',
    startTimestampMs: new Date('2023-12-24').getTime(),
  };
}

function queryScreenState() {
  return {
    dataSectionHeaders: screen
      .queryAllByLabelText('toggle section')
      .map(elem => elem.textContent),
    isShowingSetup: Boolean(screen.queryByTestId('network-setup-steps')),
    isShowingUnsupported: Boolean(screen.queryByTestId('network-op-unsupported')),
  };
}

describe('NetworkDetailsContent', () => {
  mockNeedsUpdate(false);

  describe('Details Tab', () => {
    const visibleTab = 'details' as TabKey;

    describe('Unsupported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'img'},
        {isSetup: true, itemName: 'img'},
      ])(
        'should render the `general` & `unsupported` sections when the span is not FETCH or XHR and isSetup=$isSetup. [$itemName]',
        ({isSetup}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems.img}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['General'],
            isShowingSetup: false,
            isShowingUnsupported: true,
          });
        }
      );
    });

    describe('Supported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'fetchNoDataObj'},
        {isSetup: false, itemName: 'fetchUrlSkipped'},
        {isSetup: false, itemName: 'fetchBodySkipped'},
        {isSetup: false, itemName: 'fetchWithHeaders'},
        {isSetup: false, itemName: 'fetchWithRespBody'},
      ])(
        'should render the `general` & `setup` sections when isSetup=false, no matter the item. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['General'],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([
        {isSetup: true, itemName: 'fetchNoDataObj'},
        {isSetup: true, itemName: 'fetchUrlSkipped'},
      ])(
        'should render the `general` & `setup` sections when the item has no data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['General'],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([
        {isSetup: true, itemName: 'fetchBodySkipped'},
        {isSetup: true, itemName: 'fetchWithHeaders'},
        {isSetup: true, itemName: 'fetchWithRespBody'},
      ])(
        'should render the `general` & two `headers` sections, and always the setup section, when things are setup and the item has some data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['General', 'Request Headers', 'Response Headers'],
            isShowingUnsupported: false,
            isShowingSetup: true,
          });
        }
      );
    });
  });

  describe('Request Tab', () => {
    const visibleTab = 'request' as TabKey;

    describe('Unsupported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'img'},
        {isSetup: true, itemName: 'img'},
      ])(
        'should render the `query params` & `unsupported` sections when the span is not FETCH or XHR and isSetup=$isSetup. [$itemName]',
        ({isSetup}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems.img}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['Query String Parameters'],
            isShowingSetup: false,
            isShowingUnsupported: true,
          });
        }
      );
    });

    describe('Supported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'fetchNoDataObj'},
        {isSetup: false, itemName: 'fetchUrlSkipped'},
        {isSetup: false, itemName: 'fetchBodySkipped'},
        {isSetup: false, itemName: 'fetchWithHeaders'},
        {isSetup: false, itemName: 'fetchWithRespBody'},
      ])(
        'should render the `query params` & `setup` sections when isSetup is false, no matter the item. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['Query String Parameters'],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([
        {isSetup: true, itemName: 'fetchNoDataObj'},
        {isSetup: true, itemName: 'fetchUrlSkipped'},
        {isSetup: true, itemName: 'fetchBodySkipped'},
        {isSetup: true, itemName: 'fetchWithHeaders'},
      ])(
        'should render the `query params` & `setup` sections when the item has no data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['Query String Parameters'],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([{isSetup: true, itemName: 'fetchWithRespBody'}])(
        'should render the `query params` & `request payload` sections when things are setup and the item has some data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['Query String Parameters', 'Request BodySize: 0 B'],
            isShowingUnsupported: false,
            isShowingSetup: false,
          });
        }
      );
    });
  });

  describe('Response Tab', () => {
    const visibleTab = 'response' as TabKey;

    describe('Unsupported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'img'},
        {isSetup: true, itemName: 'img'},
      ])(
        'should render the `unsupported` section when the span is not FETCH or XHR and isSetup=$isSetup. [$itemName]',
        ({isSetup}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems.img}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: [],
            isShowingSetup: false,
            isShowingUnsupported: true,
          });
        }
      );
    });

    describe('Supported Operation', () => {
      it.each([
        {isSetup: false, itemName: 'fetchNoDataObj'},
        {isSetup: false, itemName: 'fetchUrlSkipped'},
        {isSetup: false, itemName: 'fetchBodySkipped'},
        {isSetup: false, itemName: 'fetchWithHeaders'},
        {isSetup: false, itemName: 'fetchWithRespBody'},
      ])(
        'should render the `setup` section when isSetup is false, no matter the item. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: [],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([
        {isSetup: true, itemName: 'fetchNoDataObj'},
        {isSetup: true, itemName: 'fetchUrlSkipped'},
        {isSetup: true, itemName: 'fetchBodySkipped'},
        {isSetup: true, itemName: 'fetchWithHeaders'},
      ])(
        'should render the `setup` section when the item has no data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: [],
            isShowingSetup: true,
            isShowingUnsupported: false,
          });
        }
      );

      it.each([{isSetup: true, itemName: 'fetchWithRespBody'}])(
        'should render the `response body` section when things are setup and the item has some data. [$itemName]',
        ({isSetup, itemName}) => {
          render(
            <NetworkDetailsContent
              {...basicSectionProps()}
              isSetup={isSetup}
              item={mockItems[itemName]}
              visibleTab={visibleTab}
            />
          );

          expect(queryScreenState()).toStrictEqual({
            dataSectionHeaders: ['Response BodySize: 0 B'],
            isShowingUnsupported: false,
            isShowingSetup: false,
          });
        }
      );
    });
  });
});
