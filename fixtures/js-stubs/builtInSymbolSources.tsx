import type {BuiltinSymbolSource as BuiltinSymbolSourceType} from 'sentry/types';

export function BuiltInSymbolSources(
  params: BuiltinSymbolSourceType[] = []
): BuiltinSymbolSourceType[] {
  return [
    {
      sentry_key: 'amd',
      id: 'sentry:amd',
      name: 'AMD',
      hidden: false,
    },
    {
      sentry_key: 'autodesk',
      id: 'sentry:autodesk',
      name: 'Autodesk',
      hidden: false,
    },
    {
      sentry_key: 'chromium',
      id: 'sentry:chromium',
      name: 'Chromium',
      hidden: false,
    },
    {
      sentry_key: 'citrix',
      id: 'sentry:citrix',
      name: 'Citrix',
      hidden: false,
    },
    {
      sentry_key: 'electron',
      id: 'sentry:electron',
      name: 'Electron',
      hidden: false,
    },
    {
      sentry_key: 'intel',
      id: 'sentry:intel',
      name: 'Intel',
      hidden: false,
    },
    {
      sentry_key: 'microsoft',
      id: 'sentry:microsoft',
      name: 'Microsoft',
      hidden: false,
    },
    {
      sentry_key: 'mozilla',
      id: 'sentry:mozilla',
      name: 'Mozilla',
      hidden: false,
    },
    {
      sentry_key: 'nvidia',
      id: 'sentry:nvidia',
      name: 'NVIDIA',
      hidden: false,
    },
    {
      sentry_key: 'unity',
      id: 'sentry:unity',
      name: 'Unity',
      hidden: false,
    },
    ...params,
  ];
}
