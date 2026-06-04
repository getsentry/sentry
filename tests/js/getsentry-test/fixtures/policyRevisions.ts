import type {PolicyRevision} from 'getsentry/types';

export function PolicyRevisionsFixture(params: PolicyRevision[] = []) {
  return [
    {
      createdAt: '2023-01-03T22:46:47.948939Z',
      file: {
        name: 'terms-of-service-1-1.pdf',
        size: 392650,
        checksum: 'c62288d93c3495be357bd4874568d18bffd955ef',
      },
      checksum: 'c62288d93c3495be357bd4874568d18bffd955ef',
      name: 'terms-of-service-1-1.pdf',
      size: 392650,
      url: null,
      version: '2.0.0',
    },
    {
      createdAt: '2023-01-03T22:45:49.837989Z',
      file: {
        name: 'terms-of-service-1-0.pdf',
        size: 87203,
        checksum: '4bf0f81d230514235fc86c05fbf090f48c7257d6',
      },
      checksum: '4bf0f81d230514235fc86c05fbf090f48c7257d6',
      name: 'terms-of-service-1-0.pdf',
      size: 87203,
      url: null,
      version: '1.0.0',
    },
    ...params,
  ];
}
