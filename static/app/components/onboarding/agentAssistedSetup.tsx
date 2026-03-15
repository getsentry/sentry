import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {IconBot} from 'sentry/icons/iconBot';
import {IconCopy} from 'sentry/icons/iconCopy';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

const SKILLS_BASE_URL = 'https://skills.sentry.dev';

/**
 * Maps Sentry platform keys to their corresponding agent skill name and display name.
 */
const PLATFORM_SKILL_MAP: Record<string, {platformName: string; skill: string}> = {
  // Next.js
  'javascript-nextjs': {skill: 'sentry-nextjs-sdk', platformName: 'Next.js'},

  // React
  'javascript-react': {skill: 'sentry-react-sdk', platformName: 'React'},

  // Svelte / SvelteKit
  'javascript-svelte': {skill: 'sentry-svelte-sdk', platformName: 'Svelte'},
  'javascript-sveltekit': {skill: 'sentry-svelte-sdk', platformName: 'SvelteKit'},

  // NestJS
  'node-nestjs': {skill: 'sentry-nestjs-sdk', platformName: 'NestJS'},

  // Node.js / Bun / Deno
  node: {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-express': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-fastify': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-koa': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-hapi': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-connect': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-hono': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-awslambda': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-azurefunctions': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-gcpfunctions': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-cloudflare-pages': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  'node-cloudflare-workers': {skill: 'sentry-node-sdk', platformName: 'Node.js'},
  bun: {skill: 'sentry-node-sdk', platformName: 'Bun'},
  deno: {skill: 'sentry-node-sdk', platformName: 'Deno'},

  // Browser JavaScript
  javascript: {skill: 'sentry-browser-sdk', platformName: 'JavaScript'},
  'javascript-angular': {skill: 'sentry-browser-sdk', platformName: 'Angular'},
  'javascript-vue': {skill: 'sentry-browser-sdk', platformName: 'Vue'},
  'javascript-ember': {skill: 'sentry-browser-sdk', platformName: 'Ember'},
  'javascript-gatsby': {skill: 'sentry-browser-sdk', platformName: 'Gatsby'},
  'javascript-solid': {skill: 'sentry-browser-sdk', platformName: 'Solid'},
  'javascript-solidstart': {skill: 'sentry-browser-sdk', platformName: 'SolidStart'},

  // Other JS frameworks mapped to node-sdk
  'javascript-nuxt': {skill: 'sentry-node-sdk', platformName: 'Nuxt'},
  'javascript-astro': {skill: 'sentry-node-sdk', platformName: 'Astro'},
  'javascript-remix': {skill: 'sentry-node-sdk', platformName: 'Remix'},
  'javascript-tanstackstart-react': {
    skill: 'sentry-node-sdk',
    platformName: 'TanStack Start',
  },
  'javascript-react-router': {skill: 'sentry-node-sdk', platformName: 'React Router'},

  // Python
  python: {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-django': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-flask': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-fastapi': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-celery': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-aiohttp': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-asgi': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-awslambda': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-bottle': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-chalice': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-falcon': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-gcpfunctions': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-pyramid': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-quart': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-rq': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-sanic': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-serverless': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-starlette': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-tornado': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-tryton': {skill: 'sentry-python-sdk', platformName: 'Python'},
  'python-wsgi': {skill: 'sentry-python-sdk', platformName: 'Python'},

  // Ruby
  ruby: {skill: 'sentry-ruby-sdk', platformName: 'Ruby'},
  'ruby-rack': {skill: 'sentry-ruby-sdk', platformName: 'Ruby'},
  'ruby-rails': {skill: 'sentry-ruby-sdk', platformName: 'Ruby'},

  // Go
  go: {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-echo': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-fasthttp': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-fiber': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-gin': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-http': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-iris': {skill: 'sentry-go-sdk', platformName: 'Go'},
  'go-negroni': {skill: 'sentry-go-sdk', platformName: 'Go'},

  // PHP
  php: {skill: 'sentry-php-sdk', platformName: 'PHP'},
  'php-laravel': {skill: 'sentry-php-sdk', platformName: 'PHP'},
  'php-symfony': {skill: 'sentry-php-sdk', platformName: 'PHP'},

  // .NET
  dotnet: {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-aspnet': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-aspnetcore': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-awslambda': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-gcpfunctions': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-maui': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-winforms': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-wpf': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},
  'dotnet-xamarin': {skill: 'sentry-dotnet-sdk', platformName: '.NET'},

  // Flutter / Dart
  flutter: {skill: 'sentry-flutter-sdk', platformName: 'Flutter'},
  dart: {skill: 'sentry-flutter-sdk', platformName: 'Dart'},

  // React Native
  'react-native': {skill: 'sentry-react-native-sdk', platformName: 'React Native'},

  // Android / Java / Kotlin
  android: {skill: 'sentry-android-sdk', platformName: 'Android'},
  java: {skill: 'sentry-android-sdk', platformName: 'Java'},
  'java-spring': {skill: 'sentry-android-sdk', platformName: 'Java'},
  'java-spring-boot': {skill: 'sentry-android-sdk', platformName: 'Java'},
  'java-log4j2': {skill: 'sentry-android-sdk', platformName: 'Java'},
  'java-logback': {skill: 'sentry-android-sdk', platformName: 'Java'},
  kotlin: {skill: 'sentry-android-sdk', platformName: 'Kotlin'},

  // Apple (iOS, macOS)
  apple: {skill: 'sentry-cocoa-sdk', platformName: 'Apple'},
  'apple-ios': {skill: 'sentry-cocoa-sdk', platformName: 'iOS'},
  'apple-macos': {skill: 'sentry-cocoa-sdk', platformName: 'macOS'},
  'cocoa-objc': {skill: 'sentry-cocoa-sdk', platformName: 'Apple'},
  'cocoa-swift': {skill: 'sentry-cocoa-sdk', platformName: 'Apple'},

  // Elixir
  elixir: {skill: 'sentry-python-sdk', platformName: 'Elixir'},

  // Rust
  rust: {skill: 'sentry-python-sdk', platformName: 'Rust'},
};

/**
 * Get the agent skill info for a given platform key. Returns null if no skill exists.
 */
export function getAgentSkill(
  platformKey: PlatformKey
): {platformName: string; skill: string} | null {
  return PLATFORM_SKILL_MAP[platformKey] ?? null;
}

function buildPrompt(skill: string): string {
  return `Use curl to download, read and follow: ${SKILLS_BASE_URL}/${skill}/SKILL.md`;
}

interface AgentAssistedSetupProps {
  platformKey: PlatformKey;
}

export function AgentAssistedSetup({platformKey}: AgentAssistedSetupProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const [copied, setCopied] = useState(false);

  const agentSkill = getAgentSkill(platformKey);

  const handleCopy = useCallback(() => {
    if (!agentSkill) {
      return;
    }
    const prompt = buildPrompt(agentSkill.skill);
    copy(prompt, {successMessage: t('Prompt copied to clipboard')}).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackAnalytics('onboarding.agent_assisted_prompt_copied', {
        organization,
        platform: platformKey,
        skill: agentSkill.skill,
      });
    });
  }, [agentSkill, copy, organization, platformKey]);

  if (!agentSkill) {
    return null;
  }

  const prompt = buildPrompt(agentSkill.skill);

  return (
    <Wrapper>
      <HeaderRow>
        <Flex align="center" gap="sm">
          <IconBot size="md" />
          <Title>{t('Agent-Assisted Setup')}</Title>
        </Flex>
        <ExternalLink href="https://docs.sentry.io/ai/agent-skills/">
          {t('View docs')} ↗
        </ExternalLink>
      </HeaderRow>
      <Description>
        {tct(
          'Your AI coding agent will set up Sentry in your [platformName] app automatically. Works with Cursor, Claude Code, Codex, and more.',
          {platformName: agentSkill.platformName}
        )}
      </Description>
      <PromptRow>
        <PromptBox>
          <PromptText>{prompt}</PromptText>
        </PromptBox>
        <CopyButton priority="primary" size="md" icon={<IconCopy />} onClick={handleCopy}>
          {copied ? t('Copied!') : t('Copy Prompt')}
        </CopyButton>
      </PromptRow>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.accent.muted};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${space(2)} ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const HeaderRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.lg};
`;

const Description = styled('p')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.muted};
  margin: 0;
`;

const PromptRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
`;

const PromptBox = styled('div')`
  flex: 1;
  min-width: 0;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(1)} ${space(1.5)};
  overflow-x: auto;
`;

const PromptText = styled('code')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.primary};
  background: none;
  padding: 0;
  border: none;
`;

const CopyButton = styled(Button)`
  flex-shrink: 0;
  cursor: pointer;
`;
