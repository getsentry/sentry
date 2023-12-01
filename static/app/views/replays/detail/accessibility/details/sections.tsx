import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import {
  keyValueTableOrNotFound,
  KeyValueTuple,
  SectionItem,
} from 'sentry/views/replays/detail/accessibility/details/components';

export type SectionProps = {
  item: HydratedA11yFrame;
};

export function ElementSection({item}: SectionProps) {
  return (
    <SectionItem title={t('DOM Element')}>
      <CodeSnippet language="html" hideCopyButton>
        {beautify.html(item.element.element, {indent_size: 2})}
      </CodeSnippet>
    </SectionItem>
  );
}

export function GeneralSection({item}: SectionProps) {
  const data: KeyValueTuple[] = [
    {
      key: t('Impact'),
      value: item.impact,
      type: item.impact === 'critical' ? 'warning' : undefined,
    },
    {key: t('Type'), value: item.id},
    {
      key: t('Help'),
      value: <ExternalLink href={item.help_url}>{item.description}</ExternalLink>,
    },
    {key: t('Path'), value: item.element.target.join(' ')},
  ];

  return (
    <SectionItem title={t('General')}>
      {keyValueTableOrNotFound(data, t('Missing details'))}
    </SectionItem>
  );
}
