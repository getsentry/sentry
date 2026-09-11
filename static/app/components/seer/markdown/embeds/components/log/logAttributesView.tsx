import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Container} from '@sentry/scraps/layout';

import type {PageFilterDatetime} from 'sentry/types/core';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import {
  LogAttributesRendererMap,
  type RendererExtra,
} from 'sentry/views/explore/logs/fieldRenderers';
import {adjustAliases} from 'sentry/views/explore/logs/utils';

/**
 * The attribute renderers take a router location and a navigate callback so the
 * logs table can round-trip its own query params. An embed must not read or
 * write the host page's URL, so they get an inert pair instead: the one
 * renderer that reads the location (the trace link) then builds a clean target
 * from the attributes alone, and nothing in the map ever navigates.
 */
const INERT_LOCATION: Location = {
  pathname: '',
  search: '',
  hash: '',
  query: {},
  state: null,
  key: '',
  action: 'POP',
};

const INERT_NAVIGATE: ReactRouter3Navigate = () => {};

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

  if (visibleAttributes.length === 0) {
    return null;
  }

  return (
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
  );
}
