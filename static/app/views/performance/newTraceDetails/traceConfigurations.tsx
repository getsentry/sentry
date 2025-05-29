import {platformsWithNestedInstrumentationGuides} from 'sentry/data/platformCategories';
import type {Project} from 'sentry/types/project';

type ParsedPlatform = {
  platformName: string;
  framework?: string;
};

function parsePlatform(platform: string): ParsedPlatform {
  const platformParts = platform.split('-');

  // For example: dotnet-google-cloud-functions, we want to split it into
  // platformName: dotnet, framework: google-cloud-functions
  if (platformParts.length >= 3) {
    return {platformName: platformParts[0]!, framework: platformParts.slice(1).join('-')};
  }

  // With some exceptions, all other project platforms have the following two structures:
  // 1. "{language}-{framework}", e.g. "javascript-nextjs"
  // 2. "{language}", e.g. "python"
  const [platformName, framework] = platformParts;

  if (platform === 'react-native') {
    return {platformName: platformName!};
  }

  if (platform.includes('awslambda')) {
    return {platformName: platformName!, framework: 'aws-lambda'};
  }

  if (platform.includes('gcpfunctions')) {
    return {platformName: platformName!, framework: 'gcp-functions'};
  }

  return {platformName: platformName!, framework: framework!};
}

export function getCustomInstrumentationLink(project: Project | undefined): string {
  // Default to JavaScript guide if project or platform is not available
  if (!project || !project.platform) {
    return `https://docs.sentry.io/platforms/javascript/tracing/instrumentation/custom-instrumentation/`;
  }

  const {platformName, framework} = parsePlatform(project.platform);

  return platformsWithNestedInstrumentationGuides.includes(project.platform) && framework
    ? `https://docs.sentry.io/platforms/${platformName}/guides/${framework}/tracing/instrumentation/custom-instrumentation/`
    : `https://docs.sentry.io/platforms/${platformName}/tracing/instrumentation/custom-instrumentation/`;
}
