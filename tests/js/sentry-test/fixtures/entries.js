export function Entries() {
  return [
    [
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
                    module: '<unknown module>',
                    lineNo: null,
                    errors: null,
                    package: null,
                    absPath:
                      'https://sentry.io/hiventy/kraken-prod/issues/438681831/?referrer=slack#',
                    inApp: false,
                    instructionAddr: null,
                    filename: '/hiventy/kraken-prod/issues/438681831/',
                    platform: null,
                    context: [],
                    symbolAddr: null,
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
        type: 'breadcrumbs',
        data: {
          values: [
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.591Z',
              data: {
                url: 'https://reload.getsentry.net/page/',
                status_code: '201',
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.636Z',
              data: {
                url: '/api/0/organizations/?member=1',
                status_code: '200',
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.895Z',
              data: {url: '/api/0/internal/health/', status_code: '403', method: 'GET'},
              message: null,
              type: 'http',
            },
          ],
        },
      },
      {
        type: 'request',
        data: {
          fragment: '',
          cookies: [],
          inferredContentType: null,
          env: null,
          headers: [
            ['Referer', '[Filtered]'],
            [
              'User-Agent',
              'Mozilla/5.0 (Linux; Android 7.0; ONEPLUS A3003 Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/56.0.2924.87 Mobile Safari/537.36',
            ],
          ],
          url: 'https://sentry.io/hiventy/kraken-prod/issues/438681831/',
          query: 'referrer=slack',
          data: null,
          method: null,
        },
      },
    ],
    [
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
                    module: '<unknown module>',
                    lineNo: null,
                    errors: null,
                    package: null,
                    absPath:
                      'https://sentry.io/hiventy/kraken-prod/issues/438681831/?referrer=slack#',
                    inApp: false,
                    instructionAddr: null,
                    filename: '/hiventy/kraken-prod/issues/438681831/',
                    platform: null,
                    context: [],
                    symbolAddr: null,
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
        type: 'breadcrumbs',
        data: {
          values: [
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.591Z',
              data: {
                url: 'https://reload.getsentry.net/page/',
                status_code: '201',
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.636Z',
              data: {
                url: '/api/0/organizations/?member=1',
                status_code: '200',
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2018-01-23T08:12:53.895Z',
              data: {url: '/api/0/internal/health/', status_code: '403', method: 'GET'},
              message: null,
              type: 'http',
            },
          ],
        },
      },
      {
        type: 'request',
        data: {
          fragment: '',
          cookies: [],
          inferredContentType: null,
          env: null,
          headers: [
            ['Referer', '[Filtered]'],
            [
              'User-Agent',
              'Mozilla/5.0 (Linux; Android 7.0; ONEPLUS A3003 Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/56.0.2924.87 Mobile Safari/537.36',
            ],
          ],
          url: 'https://sentry.io/hiventy/kraken-prod/issues/438681831/',
          query: 'referrer=slack',
          data: null,
          method: null,
        },
      },
    ],
  ];
}
