import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {SeerEmbedComponent} from 'sentry/components/seer/markdown/embeds/registry';

interface RenderEmbedOptions {
  data: Record<string, unknown>;
  name: string;
  level?: 'block' | 'inline';
}

export function renderEmbed({name, data, level = 'block'}: RenderEmbedOptions) {
  const tag = `{% ${name} %}${JSON.stringify(data)}{% /${name} %}`;
  const raw = level === 'inline' ? `text ${tag} text` : tag;
  return render(<SeerMarkdown raw={raw} />);
}

export function getEmbedLinkHref(
  name: string,
  label: string,
  data: Record<string, unknown>
) {
  renderEmbed({name, data, level: 'inline'});
  return screen.getByRole('link', {name: label}).getAttribute('href') ?? '';
}

/**
 * Takes the component rather than a tag: the lexer only assigns block and
 * inline, so `SeerMarkdown` cannot reach the markdown level.
 */
export function renderEmbedMarkdown(
  Embed: SeerEmbedComponent,
  name: string,
  data: Record<string, unknown>
): string {
  const {container} = render(<Embed name={name} data={data} level="markdown" />);
  return container.textContent ?? '';
}
