import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

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
