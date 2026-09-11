import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EmbedSection} from 'sentry/components/seer/markdown/embeds/components/embedSection';
import {
  INERT_LOCATION,
  INERT_NAVIGATE,
} from 'sentry/components/seer/markdown/embeds/inertRouting';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import {
  LogAttributesRendererMap,
  type RendererExtra,
} from 'sentry/views/explore/logs/fieldRenderers';
import {adjustAliases} from 'sentry/views/explore/logs/utils';

interface LogAttributesViewProps {
  attributeTypes: RendererExtra['attributeTypes'];
  attributeValues: RendererExtra['attributes'];
  /**
   * Every attribute the log has, already assembled by the block.
   */
  attributes: TraceItemResponseAttribute[];
  datetime: PageFilterDatetime;
  logColors: RendererExtra['logColors'];
  projectSlug?: string;
}

export function LogAttributesView({
  attributes,
  attributeTypes,
  attributeValues,
  datetime,
  logColors,
  projectSlug,
}: LogAttributesViewProps) {
  const organization = useOrganization();
  const theme = useTheme();

  const visibleAttributes = useMemo(
    () =>
      attributes
        .filter(attribute => !HiddenLogDetailFields.includes(attribute.name))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [attributes]
  );

  const rendererExtra = useMemo<RendererExtra>(
    () => ({
      attributes: attributeValues,
      attributeTypes,
      caseSensitiveHighlighting: false,
      datetime,
      // Nothing in the embed is searching, so there is nothing to highlight.
      highlightTerms: [],
      logColors,
      location: INERT_LOCATION,
      navigate: INERT_NAVIGATE,
      organization,
      projectSlug,
      theme,
      // The attributes are already on screen, so nothing should wait to render.
      disableLazyLoad: true,
    }),
    [
      attributeTypes,
      attributeValues,
      datetime,
      logColors,
      organization,
      projectSlug,
      theme,
    ]
  );

  return (
    <EmbedSection title={t('Attributes')}>
      {visibleAttributes.length === 0 ? (
        <Text variant="muted">{t('This log has no attributes.')}</Text>
      ) : (
        <Container data-test-id="seer-log-attributes" width="100%">
          <AttributesTree<RendererExtra>
            attributes={visibleAttributes}
            // A single column keeps the tree readable at the width Seer renders in.
            columnCount={1}
            // The row actions filter the logs table the tree normally lives in,
            // which an embed has no query params to write to.
            config={{disableActions: true}}
            getAdjustedAttributeKey={adjustAliases}
            renderers={LogAttributesRendererMap}
            rendererExtra={rendererExtra}
          />
        </Container>
      )}
    </EmbedSection>
  );
}
