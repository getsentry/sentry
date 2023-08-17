import {SourceMapsArchive} from 'sentry/types';

export function SourceMapArchive(
  params: Partial<SourceMapsArchive> = {}
): SourceMapsArchive {
  return {
    date: '2020-05-06T13:41:48.926535Z',
    type: 'release',
    id: 75,
    fileCount: 0,
    name: '1234',
    ...params,
  };
}
