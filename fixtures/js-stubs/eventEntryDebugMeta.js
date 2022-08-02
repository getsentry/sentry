export function EventEntryDebugMeta(params = {}) {
  return {
    type: 'debugmeta',
    data: {
      images: [
        {
          arch: 'x86_64',
          candidates: [
            {
              download: {
                status: 'notfound',
              },
              source: 'sentry:microsoft',
              source_name: 'Microsoft',
            },
            {
              debug: {status: 'ok'},
              download: {
                features: {
                  has_debug_info: true,
                  has_sources: false,
                  has_symbols: true,
                  has_unwind_info: false,
                },
                status: 'ok',
              },
              location: 'sentry://project_debug_file/17',
              source: 'sentry:project',
              source_name: 'Sentry',
            },
            {
              download: {
                status: 'malformed',
              },
              location: 'burgenland',
              source_name: 'Austria',
            },
            {
              download: {
                status: 'malformed',
              },
              location: 'brussels',
              source_name: 'Belgium',
            },
            {
              download: {
                status: 'malformed',
              },
              location: 'arizona',
              source_name: 'America',
            },
          ],
          code_file: '/Users/foo/Coding/sentry-native/build/./sentry_example',
          code_id: '43fd26cc39043633a546f1b003ea17a4',
          debug_file: 'sentry_example',
          debug_id: '43fd26cc-3904-3633-a546-f1b003ea17a4',
          debug_status: 'found',
          features: {
            has_debug_info: true,
            has_sources: false,
            has_symbols: true,
            has_unwind_info: false,
          },
          image_addr: '0x10753f000',
          image_size: 16384,
          type: 'macho',
          unwind_status: 'unused',
        },
      ],
    },
    ...params,
  };
}
