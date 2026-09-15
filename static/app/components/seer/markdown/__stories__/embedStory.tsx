import type {ComponentProps, ReactNode} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {SeerEmbedExample} from 'sentry/components/seer/markdown/embeds/schemas';
import {SEER_EMBED_SCHEMAS} from 'sentry/components/seer/markdown/embeds/schemas';
import {useSeerMarkdownText} from 'sentry/components/seer/markdown/markdownText';
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

/**
 * The story's table of contents collects h2 through h6, so these read as
 * subtitles without being headings -- otherwise every embed would add four
 * entries to the right-hand nav.
 */
function LevelSection({title, children}: {children: ReactNode; title: string}) {
  return (
    <Stack gap="sm">
      <Text size="xs" bold uppercase variant="muted">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

interface EmbedVariantProps {
  data: Record<string, unknown>;
  name: EmbedName;
  demoProps?: Omit<ComponentProps<typeof Demo>, 'children'>;
  /** Omitted when there is only one example, which the section already names. */
  label?: string;
}

export function EmbedVariant({data, demoProps, label, name}: EmbedVariantProps) {
  const levels: readonly EmbedLevel[] = SEER_EMBED_SCHEMAS[name].level;
  const tag = formatTag(name, data);
  // Serialized from the tag alone, so the demo prose around the inline example
  // does not end up in the copied text.
  const {node, text: markdown} = useSeerMarkdownText(tag);

  const demo = {
    minHeight: undefined,
    maxHeight: undefined,
    overflow: undefined,
    ...demoProps,
  };

  return (
    <Stack gap="xl">
      {label ? (
        <Text size="sm" bold>
          {label}
        </Text>
      ) : null}

      <LevelSection title="Tag">
        <CodeBlock language="markdown" dark>
          {tag}
        </CodeBlock>
      </LevelSection>

      {levels.includes('inline') ? (
        <LevelSection title="Inline">
          <Demo {...demo}>
            <SeerMarkdown raw={`Lorem ipsum ${tag} dolor sit amet.`} />
          </Demo>
        </LevelSection>
      ) : null}

      {levels.includes('block') ? (
        <LevelSection title="Block">
          <Demo {...demo}>
            <SeerMarkdown raw={tag} />
          </Demo>
        </LevelSection>
      ) : null}

      {markdown ? (
        <LevelSection title="Markdown">
          <CodeBlock language="markdown" dark>
            {markdown}
          </CodeBlock>
        </LevelSection>
      ) : null}

      {node}
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
    <Stack gap="xl">
      <Stack gap="xs">
        <Text size="sm" variant="muted">
          {schema.description}
        </Text>
        {'featureFlag' in schema ? (
          <Text size="sm" variant="muted">
            Flag: {[schema.featureFlag].flat().join(' or ')}
          </Text>
        ) : null}
      </Stack>
      <Stack gap="2xl">
        {children ??
          examples.map(example => (
            <EmbedVariant
              key={example.label}
              name={name}
              label={examples.length > 1 ? example.label : undefined}
              data={example.data}
            />
          ))}
      </Stack>
    </Stack>
  );
}
