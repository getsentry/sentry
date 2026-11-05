import {IconDocs} from '@sentry/icons/docs';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ResourceLink} from './resourceLink';

export const Docs = defineSeerEmbed({
  name: 'docs',
  render({href, title}, level) {
    switch (level) {
      case 'markdown':
        return (
          <ResourceLink icon={IconDocs} href={href} title={title} format="markdown" />
        );
      case 'block':
      case 'inline':
        return <ResourceLink icon={IconDocs} href={href} title={title} />;
    }
  },
});
