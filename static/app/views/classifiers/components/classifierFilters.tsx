import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t} from 'sentry/locale';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {
  getClassifierFilterParts,
  getFilterTree,
  type FilterTreeNode,
} from 'sentry/views/classifiers/utils';

function LabeledGroup({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="xs">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Stack gap="sm" borderLeft="secondary" paddingLeft="md">
        {children}
      </Stack>
    </Stack>
  );
}

function FilterNode({node}: {node: FilterTreeNode}) {
  if (node.type === 'filter') {
    return <ProvidedFormattedQuery query={node.query} />;
  }

  return (
    <LabeledGroup label={t('Any of')}>
      {node.options.map(option =>
        option.length === 1 ? (
          <FilterNode key={option[0]!.key} node={option[0]!} />
        ) : (
          <LabeledGroup key={option[0]!.key} label={t('All of')}>
            {option.map(child => (
              <FilterNode key={child.key} node={child} />
            ))}
          </LabeledGroup>
        )
      )}
    </LabeledGroup>
  );
}

export function ClassifierFilters({classifier}: {classifier: TelemetryClassifier}) {
  const {query} = getClassifierFilterParts(classifier.filterQuery);
  if (!query) {
    return null;
  }

  const tree = getFilterTree(query);
  return (
    <Stack as="section" gap="md">
      <Heading as="h3" size="md">
        {t('Filters')}
      </Heading>
      {tree?.length ? (
        <Stack gap="sm">
          {tree.map(node => (
            <FilterNode key={node.key} node={node} />
          ))}
        </Stack>
      ) : (
        <ProvidedFormattedQuery query={query} />
      )}
    </Stack>
  );
}
