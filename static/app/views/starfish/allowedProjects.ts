import {StarfishType} from 'sentry/views/starfish/types';

export const ALLOWED_PROJECT_IDS_FOR_ORG_SLUG: {
  [slug: string]: string[];
} = {
  sentry: ['1', '300688'],
  codecov: ['5215654'],
  peated: ['4504120414765056'],
  'sentry-sdks': ['5428557'],
};

export const STARFISH_TYPE_FOR_PROJECT: {[project: string]: StarfishType} = {
  5428557: StarfishType.MOBILE,
};
