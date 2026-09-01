import type {ComponentProps, ReactNode} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {SeerEmbedExample} from 'sentry/components/seer/markdown/embeds/schemas';
import {SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {Demo} from 'sentry/stories';

type EmbedName = keyof typeof SEER_EMBED_SCHEMAS;
type EmbedLevel = (typeof SEER_EMBED_SCHEMAS)[EmbedName]['level'][number];

function formatTag(name: EmbedName, data: Record<string, unknown>): string {
  return `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
}

function formatEmbedLabel(name: EmbedName): string {
  const label = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStoryExamples(
  name: EmbedName,
  examples: readonly SeerEmbedExample[]
): SeerEmbedExample[] {
  const seenLevelExamples = new Set<string>();

  return examples.flatMap(example => {
    if (!example.level) {
      return example;
    }

    const key = JSON.stringify(example.data);
    if (seenLevelExamples.has(key)) {
      return [];
    }

    seenLevelExamples.add(key);
    return {...example, label: formatEmbedLabel(name)};
  });
}

function formatVariant(
  name: EmbedName,
  levels: readonly EmbedLevel[],
  data: Record<string, unknown>
): string {
  const tag = formatTag(name, data);

  return levels
    .map(level =>
      level === 'inline'
        ? `Inline: Lorem ipsum ${tag} dolor sit amet.`
        : `Block:\n\n${tag}`
    )
    .join('\n\n');
}

interface EmbedVariantProps {
  data: Record<string, unknown>;
  label: string;
  name: EmbedName;
  demoProps?: Omit<ComponentProps<typeof Demo>, 'children'>;
}

export function EmbedVariant({data, demoProps, label, name}: EmbedVariantProps) {
  const markdown = formatVariant(name, SEER_EMBED_SCHEMAS[name].level, data);

  return (
    <Stack gap="sm">
      <Text size="sm" bold>
        {label}
      </Text>
      <Demo {...demoProps}>
        <SeerMarkdown raw={markdown} />
      </Demo>
      <CodeBlock language="markdown" dark>
        {markdown}
      </CodeBlock>
    </Stack>
  );
}

interface EmbedStoryProps {
  name: EmbedName;
  children?: ReactNode;
}

export function EmbedStory({children, name}: EmbedStoryProps) {
  const schema = SEER_EMBED_SCHEMAS[name];
  const examples = getStoryExamples(name, schema.examples);

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        Level: {schema.level.join(', ')}
        {'featureFlag' in schema ? ` · Flag: ${schema.featureFlag}` : null}
      </Text>
      <Text size="sm" variant="muted">
        {schema.description}
      </Text>
      <Stack gap="lg">
        {children ??
          examples.map(example => (
            <EmbedVariant
              key={example.label}
              name={name}
              label={example.label}
              data={example.data}
            />
          ))}
      </Stack>
    </Stack>
  );
}
