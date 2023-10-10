import {StarfishType} from 'sentry/views/starfish/types';

export const ALLOWED_PROJECT_IDS_FOR_ORG_SLUG: {
  [slug: string]: string[];
} = {
  sentry: [
    '1', // Sentry
    '300688', // Snuba
    '4505160011087872', // GibPotato PHP
    '4505148785885184', // GibPotato Go
  ],
  codecov: ['5215654'],
  peated: ['4505138082349056'],
  'sentry-sdks': ['5428557'],
  demo: ['6249899'],
  'testorg-az': ['6249899'],
};

export const STARFISH_TYPE_FOR_PROJECT: {[project: string]: StarfishType} = {
  5428557: StarfishType.MOBILE,
  6249899: StarfishType.MOBILE,
};
