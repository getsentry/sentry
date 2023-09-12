import {FeedbackItemResponse, FeedbackListResponse} from 'sentry/utils/feedback/types';

export const exampleItemResponse: FeedbackItemResponse = {
  browser: {
    name: 'Chome',
    version: '103.0.38',
  },
  contact_email: 'colton.allen@sentry.io',
  device: {
    brand: 'Apple',
    family: 'iPhone',
    model: '11',
    name: 'iPhone 11',
  },
  dist: 'abc123',
  environment: 'production',
  id: '1ffe0775ac0f4417aed9de36d9f6f8dc',
  locale: {
    lang: 'en',
    timezone: 'UTC+1',
  },
  message: 'I really like this user-feedback feature!',
  os: {
    name: 'iOS',
    version: '16.2',
  },
  platform: 'javascript',
  project: '11276',
  release: 'version@1.3',
  replay_id: 'ec3b4dc8b79f417596f7a1aa4fcca5d2',
  sdk: {
    name: 'sentry.javascript.react',
    version: '6.18.1',
  },
  status: 'unresolved',
  tags: {
    hello: 'is',
    it: ['me', "you're", 'looking', 'for'],
  },
  timestamp: '2023-08-31T14:10:34.954048',
  url: 'https://docs.sentry.io/platforms/javascript/',
  user: {
    display_name: 'John Doe',
    email: 'john.doe@example.com',
    id: '30246326',
    ip: '213.164.1.114',
    username: 'John Doe',
  },
};

export const exampleListResponse: FeedbackListResponse = [exampleItemResponse];
