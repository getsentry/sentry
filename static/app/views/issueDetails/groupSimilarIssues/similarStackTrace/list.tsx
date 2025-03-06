import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SimilarSpectrum from 'sentry/components/similarSpectrum';
import {t} from 'sentry/locale';
import type {SimilarItem} from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import Item from './item';
import Toolbar from './toolbar';

type DefaultProps = {
  filteredItems: SimilarItem[];
};

type Props = {
  groupId: string;
  hasSimilarityEmbeddingsFeature: boolean;
  items: SimilarItem[];
  location: Location;
  onMerge: () => void;
  orgId: Organization['id'];
  pageLinks: string | null;
  project: Project;
} & DefaultProps;

function Empty() {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning small withIcon={false}>
          {t('No issues with a similar stack trace have been found.')}
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

function List({
  orgId,
  groupId,
  project,
  items,
  filteredItems = [],
  pageLinks,
  onMerge,
  location,
  hasSimilarityEmbeddingsFeature,
}: Props) {
  const [showAllItems, setShowAllItems] = useState(false);

  const hasHiddenItems = !!filteredItems.length;
  const hasResults = items.length > 0 || hasHiddenItems;
  const itemsWithFiltered = items.concat(showAllItems ? filteredItems : []);
  const organization = useOrganization();
  const itemsWouldGroup = hasSimilarityEmbeddingsFeature
    ? itemsWithFiltered.map(item => ({
        id: item.issue.id,
        shouldBeGrouped: item.aggregate?.shouldBeGrouped,
      }))
    : undefined;

  if (!hasResults) {
    return <Empty />;
  }

  return (
    <Fragment>
      <Header>
        {!hasSimilarityEmbeddingsFeature && (
          <SimilarSpectrum
            highSpectrumLabel={t('Similar')}
            lowSpectrumLabel={t('Not Similar')}
          />
        )}
        {hasSimilarityEmbeddingsFeature && (
          <SimilarSpectrum
            highSpectrumLabel={t('Most Similar')}
            lowSpectrumLabel={t('Less Similar')}
          />
        )}
      </Header>
      <Panel>
        <Toolbar
          onMerge={onMerge}
          groupId={groupId}
          project={project}
          organization={organization}
          itemsWouldGroup={itemsWouldGroup}
          hasSimilarityEmbeddingsFeature={hasSimilarityEmbeddingsFeature}
        />

        <PanelBody>
          {itemsWithFiltered.map(item => (
            <Item
              key={item.issue.id}
              orgId={orgId}
              groupId={groupId}
              project={project}
              location={location}
              hasSimilarityEmbeddingsFeature={hasSimilarityEmbeddingsFeature}
              {...item}
            />
          ))}

          {hasHiddenItems && !showAllItems && !hasSimilarityEmbeddingsFeature && (
            <Footer>
              <Button onClick={() => setShowAllItems(true)}>
                {t('Show %s issues below threshold', filteredItems.length)}
              </Button>
            </Footer>
          )}
        </PanelBody>
      </Panel>
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

export default List;

const Header = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(1)};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(1.5)};
`;
