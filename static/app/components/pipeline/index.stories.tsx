import {Fragment, useState} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import StructuredEventData from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';

import {openPipelineModal} from './modal';
import {PIPELINE_REGISTRY} from './registry';
import type {PipelineType} from './types';
import {usePipeline} from './usePipeline';

const pipelineMenuItems = PIPELINE_REGISTRY.map(p => ({
  key: `${p.type}:${p.provider}`,
  label: `${p.type} / ${p.provider}`,
}));

function UsePipelineDemo() {
  const [selected, setSelected] = useState<string | null>(null);

  const parsed = selected
    ? {
        type: selected.split(':')[0] as PipelineType,
        provider: selected.split(':')[1]!,
      }
    : null;

  return (
    <Flex direction="column" gap="lg">
      <DropdownMenu
        triggerLabel={parsed ? `${parsed.type} / ${parsed.provider}` : 'Select pipeline'}
        items={pipelineMenuItems}
        onAction={key => setSelected(key as string)}
      />
      {parsed && (
        <PipelineRunner key={selected} type={parsed.type} provider={parsed.provider} />
      )}
    </Flex>
  );
}

function PipelineRunner({type, provider}: {provider: string; type: PipelineType}) {
  const pipeline = usePipeline(type as 'integration', provider as 'github');

  function getStatus(): string {
    if (pipeline.isComplete) {
      return 'complete';
    }
    if (pipeline.error) {
      return 'error';
    }
    if (pipeline.isInitializing) {
      return 'initializing';
    }
    if (pipeline.isAdvancing) {
      return 'advancing';
    }
    if (pipeline.stepDefinition) {
      return 'active';
    }
    return 'idle';
  }

  return (
    <Flex direction="column" gap="md">
      <Container border="primary" padding="md">
        <Flex direction="column" gap="sm">
          <Flex gap="lg" align="center">
            <Flex gap="sm" align="center">
              <Text bold>Status:</Text>
              <Text>{getStatus()}</Text>
            </Flex>
            {pipeline.stepDefinition && (
              <Flex gap="sm" align="center">
                <Text bold>Step:</Text>
                <Text>{pipeline.stepDefinition.stepId}</Text>
              </Flex>
            )}
            {pipeline.totalSteps > 0 && (
              <Flex gap="sm" align="center">
                <Text bold>Progress:</Text>
                <Text>
                  {pipeline.stepIndex + 1} / {pipeline.totalSteps}
                </Text>
              </Flex>
            )}
          </Flex>
          <Flex gap="lg" align="center">
            <Text size="sm" variant="muted">
              initializing={String(pipeline.isInitializing)} advancing=
              {String(pipeline.isAdvancing)} complete={String(pipeline.isComplete)} error=
              {String(!!pipeline.error)}
            </Text>
          </Flex>
        </Flex>
      </Container>

      {pipeline.error && <Text variant="muted">Error: {pipeline.error.message}</Text>}

      {pipeline.view}

      {pipeline.isComplete && (
        <Fragment>
          <Text bold>Pipeline complete!</Text>
          <StructuredEventData data={pipeline.completionData} />
        </Fragment>
      )}
    </Flex>
  );
}

function PipelineModalDemo() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  return (
    <Flex direction="column" gap="lg">
      <DropdownMenu
        triggerLabel="Open pipeline modal"
        items={pipelineMenuItems}
        onAction={key => {
          const [type, provider] = (key as string).split(':');
          setResult(null);
          openPipelineModal({
            type: type as 'integration',
            provider: provider as 'github',
            onComplete: data => setResult(data as Record<string, unknown>),
          });
        }}
      />
      {result && (
        <Fragment>
          <Text bold>Pipeline completed with:</Text>
          <StructuredEventData data={result} />
        </Fragment>
      )}
    </Flex>
  );
}

export default Storybook.story('Pipeline', story => {
  story('usePipeline', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="usePipeline" /> is the core state machine for driving
          backend pipelines from React. It manages initialization, step transitions, error
          handling, and completion — but does not render any UI itself beyond the step
          components registered in the pipeline definition.
        </p>
        <p>
          The hook communicates with the backend pipeline system via the organization
          pipeline REST API. Each pipeline provider (e.g. GitHub, Slack, SAML) registers a
          definition with ordered step components. The hook matches the backend's current
          step to the corresponding frontend component and renders it via the{' '}
          <code>view</code> property.
        </p>
        <p>
          Select a pipeline below to initialize it and step through interactively. The
          debug panel shows the hook's full state as it transitions.
        </p>
        <UsePipelineDemo />
      </Fragment>
    );
  });

  story('PipelineModal', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="openPipelineModal" /> opens a modal that wraps{' '}
          <Storybook.JSXNode name="usePipeline" /> with standard modal chrome — a header
          showing the provider name and step progress, a body rendering the current step,
          and automatic close on completion.
        </p>
        <p>
          It accepts typed <code>onComplete</code> and <code>onClose</code> callbacks. The
          completion data type is inferred from the pipeline definition, so{' '}
          <code>{'openPipelineModal({type: "integration", provider: "github"})'}</code>{' '}
          will type the callback data as <code>GitHubCompletionData</code>.
        </p>
        <p>Select a pipeline below to open it in a modal.</p>
        <PipelineModalDemo />
      </Fragment>
    );
  });
});
