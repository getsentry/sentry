import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {CodeBlock} from 'sentry/components/core/code';
import {Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Prose} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  getIsAiGenerationNode,
  getIsExecuteToolNode,
  getTraceNodeAttribute,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {hasAIInputAttribute} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';
import {hasAIOutputAttribute} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

type SupportedSDKLanguage = 'javascript' | 'python';

const knownSpanOrigins = {
  python: [
    'auto.ai.langchain',
    'auto.ai.openai_agents',
    'auto.ai.openai',
    'auto.ai.langgraph',
    'auto.ai.anthropic',
    'auto.ai.litellm',
    'auto.ai.google_genai',
    'auto.ai.pydantic_ai',
  ],
  javascript: ['auto.ai.anthropic', 'auto.ai.openai', 'auto.vercelai.otel'],
} as const;

function getSDKLanguage(sdkName?: string): SupportedSDKLanguage | 'other' {
  if (sdkName?.startsWith('sentry.python')) {
    return 'python';
  }
  if (sdkName?.startsWith('sentry.javascript')) {
    return 'javascript';
  }
  return 'other';
}

function getInstrumentationType(
  sdkLanguage: SupportedSDKLanguage | 'other',
  spanOrigin?: string
): 'automatic' | 'manual' {
  if (sdkLanguage === 'other') {
    return 'manual';
  }

  if (knownSpanOrigins[sdkLanguage].includes(spanOrigin as any)) {
    return 'automatic';
  }

  return 'manual';
}

const contentComponents = {
  python: PythonContent,
  javascript: JavaScriptContent,
} as const;

export function AIIOAlert({
  node,
  attributes,
  event,
}: {
  node: TraceTreeNode<TraceTree.EAPSpan | TraceTree.Span | TraceTree.Transaction>;
  attributes?: TraceItemResponseAttribute[];
  event?: EventTransaction;
}) {
  const theme = useTheme();
  const isChonk = isChonkTheme(theme);
  const {dismiss, isDismissed} = useDismissAlert({key: 'genai-io-alert-dismissed'});

  const isSupportedNodeType = getIsAiGenerationNode(node) || getIsExecuteToolNode(node);
  const hasData =
    hasAIInputAttribute(node, attributes, event) ||
    hasAIOutputAttribute(node, attributes, event);

  if (isDismissed || !isSupportedNodeType || hasData) {
    return null;
  }

  const spanOrigin = getTraceNodeAttribute('origin', node, event, attributes)?.toString();
  const sdkName = getTraceNodeAttribute('sdk.name', node, event, attributes)?.toString();

  const sdkLanguage = getSDKLanguage(sdkName);
  const instrumentationType = getInstrumentationType(sdkLanguage, spanOrigin);

  if (sdkLanguage === 'other') {
    return null;
  }

  const ContentComponent = contentComponents[sdkLanguage];

  return (
    <Alert.Container>
      <Alert type="info">
        <Stack direction="column" gap="md" paddingTop="2xs">
          <Heading
            as="h4"
            variant="accent"
            style={{
              color: isChonk ? undefined : 'inherit',
            }}
          >
            {t('Missing the input and output of your AI model?')}
          </Heading>
          {instrumentationType === 'automatic' ? (
            <ContentComponent spanOrigin={spanOrigin} sdkLanguage={sdkLanguage} />
          ) : (
            <ManualContent sdkLanguage={sdkLanguage} />
          )}
          <Stack direction="row" paddingTop="xs" justify="start">
            <Alert.Button onClick={dismiss}>Dismiss</Alert.Button>
          </Stack>
        </Stack>
      </Alert>
    </Alert.Container>
  );
}

type PythonSpanOrigin = (typeof knownSpanOrigins.python)[number];
const pythonIntegrationLinks: Record<PythonSpanOrigin, string> = {
  'auto.ai.langchain': 'https://docs.sentry.io/platforms/python/integrations/langchain/',
  'auto.ai.openai_agents':
    'https://docs.sentry.io/platforms/python/integrations/openai-agents/',
  'auto.ai.openai': 'https://docs.sentry.io/platforms/python/integrations/openai/',
  'auto.ai.langgraph': 'https://docs.sentry.io/platforms/python/integrations/langgraph/',
  'auto.ai.anthropic': 'https://docs.sentry.io/platforms/python/integrations/anthropic/',
  'auto.ai.litellm': 'https://docs.sentry.io/platforms/python/integrations/litellm/',
  'auto.ai.google_genai':
    'https://docs.sentry.io/platforms/python/integrations/google-genai/',
  'auto.ai.pydantic_ai':
    'https://docs.sentry.io/platforms/python/integrations/pydantic-ai/',
};

function PythonContent({
  spanOrigin,
  sdkLanguage,
}: {
  sdkLanguage: SupportedSDKLanguage;
  spanOrigin?: string;
}) {
  const integrationLink = pythonIntegrationLinks[spanOrigin as PythonSpanOrigin];
  if (!integrationLink) {
    return <ManualContent sdkLanguage={sdkLanguage} />;
  }
  return (
    <Fragment>
      <Prose>
        {tct(
          'Simply enable [code:send_default_pii] in your Sentry init call to start capturing it:',
          {
            code: <StyledCode />,
          }
        )}
      </Prose>
      <CodeBlock dark language="python" linesToHighlight={[3]} css={codeSnippetStyles}>
        {`sentry_sdk.init(
  # ...
  send_default_pii=True,
);`}
      </CodeBlock>
      <Prose>
        {tct('For more details, see the [link:integration docs].', {
          link: <ExternalLink href={integrationLink} />,
        })}
      </Prose>
    </Fragment>
  );
}

type JavascriptSpanOrigin = (typeof knownSpanOrigins.javascript)[number];
const jsIntegrationNames: Record<JavascriptSpanOrigin, string> = {
  'auto.ai.anthropic': 'anthropicAIIntegration',
  'auto.ai.openai': 'openAIIntegration',
  'auto.vercelai.otel': 'vercelAIIntegration',
};
const jsIntegrationLinks: Record<JavascriptSpanOrigin, string> = {
  'auto.ai.anthropic':
    'https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/anthropic/',
  'auto.ai.openai':
    'https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/openai/',
  'auto.vercelai.otel':
    'https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/vercelai/',
};

function JavaScriptContent({
  spanOrigin,
  sdkLanguage,
}: {
  sdkLanguage: SupportedSDKLanguage;
  spanOrigin?: string;
}) {
  const integrationName = jsIntegrationNames[spanOrigin as JavascriptSpanOrigin];
  if (!integrationName) {
    return <ManualContent sdkLanguage={sdkLanguage} />;
  }
  return (
    <Fragment>
      <Prose>
        {tct(
          'Simply set [code:recordInputs] and [code:recordOutputs] to [code:true] when initializing the SDK integration:',
          {
            code: <StyledCode />,
          }
        )}
      </Prose>
      <CodeBlock
        dark
        language="javascript"
        linesToHighlight={[5, 6]}
        css={codeSnippetStyles}
      >
        {`Sentry.init({
  // ...
  integrations: [
    Sentry.${integrationName}({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
});`}
      </CodeBlock>
      <Prose>
        {tct('For more details, see the [link:integration docs].', {
          link: (
            <ExternalLink href={jsIntegrationLinks[spanOrigin as JavascriptSpanOrigin]} />
          ),
        })}
      </Prose>
    </Fragment>
  );
}

function ManualContent({sdkLanguage}: {sdkLanguage: SupportedSDKLanguage}) {
  return (
    <Fragment>
      <Prose>
        {tct('Check out the [link:AI instrumentation docs] for more details.', {
          link: (
            <ExternalLink
              href={
                sdkLanguage === 'javascript'
                  ? 'https://docs.sentry.io/platforms/javascript/guides/node/tracing/instrumentation/ai-agents-module/'
                  : 'https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/'
              }
            />
          ),
        })}
      </Prose>
    </Fragment>
  );
}

// TODO(aknaus): Remove this once the Prose component adds styling for code elements
const StyledCode = styled('code')`
  color: ${p => p.theme.pink400};
`;

const codeSnippetStyles = css`
  margin: 0 !important;
`;
