import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Text} from 'sentry/components/core/text';
import BaseSearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

import {AssertionFailureTree} from './assertions/assertionFailure/assertionFailureTree';

type CustomRenderersProps = AttributesFieldRendererProps<RenderFunctionBaggage>;

const DEBOUNCE_DELAY = 200;

export function UptimeCheckAttributes({
  attributes,
}: {
  attributes: TraceItemResponseAttribute[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_DELAY);

  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();

  const filteredAndSortedAttributes = useMemo(() => {
    const sortedAttributes = [...attributes].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    if (!debouncedSearchQuery.trim()) {
      return sortedAttributes;
    }

    const normalizedSearchQuery = debouncedSearchQuery.toLowerCase().trim();

    const matchingAttributes = sortedAttributes.filter(attribute => {
      return attribute.name.toLowerCase().trim().includes(normalizedSearchQuery);
    });

    return matchingAttributes;
  }, [attributes, debouncedSearchQuery]);

  const customRenderers: Record<
    string,
    (props: CustomRenderersProps) => React.ReactNode
  > = {
    assertion_failure_data: (props: CustomRenderersProps) => {
      if (props.item.value === null) {
        return <Text variant="muted">null</Text>;
      }

      return <AssertionFailureTree assertion={props.item.value.toString()} />;
    },
  };

  return (
    <FoldSection
      sectionKey={SectionKey.SPAN_ATTRIBUTES}
      title={t('Attributes')}
      disableCollapsePersistence
    >
      <Stack gap="lg" maxWidth="100%">
        <BaseSearchBar
          placeholder={t('Search')}
          onChange={query => setSearchQuery(query)}
          query={searchQuery}
          size="sm"
        />
        {filteredAndSortedAttributes.length > 0 ? (
          <div>
            <AttributesTree
              columnCount={1}
              attributes={filteredAndSortedAttributes}
              renderers={customRenderers}
              rendererExtra={{
                theme,
                location,
                organization,
              }}
            />
          </div>
        ) : (
          <NoAttributesMessage>
            <p>{t('No matching attributes found')}</p>
          </NoAttributesMessage>
        )}
      </Stack>
    </FoldSection>
  );
}

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: ${space(4)};
  color: ${p => p.theme.tokens.content.secondary};
`;
