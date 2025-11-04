import {getNodeLogsOnboarding} from 'sentry/utils/gettingStartedDocs/node';

export const logs = getNodeLogsOnboarding({
  docsPlatform: 'aws-lambda',
  packageName: '@sentry/aws-serverless',
});
