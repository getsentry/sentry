import type {ReactElement} from 'react';

import {AnsiText} from 'sentry/components/ansiText';

interface RenderLinksInTextProps {
  exceptionText: string;
}

export const renderLinksInText = ({
  exceptionText,
}: RenderLinksInTextProps): ReactElement => {
  return <AnsiText text={exceptionText} />;
};

// Maps the SDK name to the url token for docs
export const sourceMapSdkDocsMap: Record<string, string> = {
  'sentry.javascript.aws-serverless': 'aws-lambda',
  'sentry.javascript.browser': 'javascript',
  'sentry.javascript.node': 'node',
  'sentry.javascript.node.hapi': 'hapi',
  'sentry.javascript.react': 'react',
  'sentry.javascript.angular': 'angular',
  'sentry.javascript.angular-ivy': 'angular',
  'sentry.javascript.bun': 'bun',
  'sentry.javascript.capacitor': 'capacitor',
  'sentry.javascript.cloudflare': 'cloudflare',
  'sentry.javascript.cordova': 'cordova',
  'sentry.javascript.deno': 'deno',
  'sentry.javascript.electron': 'electron',
  'sentry.javascript.ember': 'ember',
  'sentry.javascript.gatsby': 'gatsby',
  'sentry.javascript.google-cloud-serverless': 'gcp-functions',
  'sentry.javascript.vue': 'vue',
  'sentry.javascript.nestjs': 'nestjs',
  'sentry.javascript.nextjs': 'nextjs',
  'sentry.javascript.nuxt': 'nuxt',
  'sentry.javascript.remix': 'remix',
  'sentry.javascript.solid': 'solid',
  'sentry.javascript.solid-start': 'solidstart',
  'sentry.javascript.svelte': 'svelte',
  'sentry.javascript.sveltekit': 'sveltekit',
  'sentry.javascript.react-native': 'react-native',
  'sentry.javascript.astro': 'astro',
};
