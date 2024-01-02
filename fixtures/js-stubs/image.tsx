import {
  CandidateDownloadStatus,
  CandidateProcessingStatus,
  type Image as TImage,
  ImageStatus,
} from 'sentry/types/debugImage';

export function Image(params: Partial<TImage> = {}): TImage {
  return {
    arch: 'x86_64',
    candidates: [
      {
        location: '',
        download: {
          status: CandidateDownloadStatus.NOT_FOUND,
        },
        source: 'sentry:microsoft',
        source_name: 'Microsoft',
      },
      {
        debug: {status: CandidateProcessingStatus.OK},
        download: {
          features: {
            has_debug_info: true,
            has_sources: false,
            has_symbols: true,
            has_unwind_info: false,
          },
          status: CandidateDownloadStatus.OK,
        },
        location: 'sentry://project_debug_file/17',
        source: 'sentry:project',
        source_name: 'Sentry',
      },
      {
        download: {
          status: CandidateDownloadStatus.MALFORMED,
        },
        location: 'burgenland',
        source_name: 'Austria',
        source: 'sentry://project_debug_file/18',
      },
      {
        download: {
          status: CandidateDownloadStatus.MALFORMED,
        },
        location: 'brussels',
        source: 'sentry://project_debug_file/19',
        source_name: 'Belgium',
      },
      {
        download: {
          status: CandidateDownloadStatus.MALFORMED,
        },
        location: 'arizona',
        source: 'sentry://project_debug_file/20',
        source_name: 'America',
      },
    ],
    code_file: '/Users/foo/Coding/sentry-native/build/./sentry_example',
    code_id: '43fd26cc39043633a546f1b003ea17a4',
    debug_file: 'sentry_example',
    debug_id: '43fd26cc-3904-3633-a546-f1b003ea17a4',
    debug_status: ImageStatus.FOUND,
    features: {
      has_debug_info: true,
      has_sources: false,
      has_symbols: true,
      has_unwind_info: false,
    },
    image_addr: '0x10753f000',
    image_size: 16384,
    type: 'macho',
    unwind_status: ImageStatus.UNUSED,
    ...params,
  };
}
