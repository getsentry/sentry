import {
  ResourceLink,
  resourceLinkMarkdown,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconDocs} from 'sentry/icons';

export const Docs = defineSeerEmbed({
  name: 'docs',
  render({href, title}, level) {
    switch (level) {
      case 'markdown':
        return resourceLinkMarkdown(href, title);
      case 'block':
      case 'inline':
        return <ResourceLink icon={IconDocs} href={href} title={title} />;
    }
  },
});
