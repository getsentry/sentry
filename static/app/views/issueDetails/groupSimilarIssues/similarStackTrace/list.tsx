import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SimilarSpectrum from 'sentry/components/similarSpectrum';
import {t} from 'sentry/locale';
import type {SimilarItem} from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';

import Item from './item';
import Toolbar from './toolbar';

type DefaultProps = {
  filteredItems: Array<SimilarItem>;
};

type Props = {
  groupId: string;
  items: Array<SimilarItem>;
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
}: Props) {
  const [showAllItems, setShowAllItems] = useState(false);

  const hasHiddenItems = !!filteredItems.length;
  const hasResults = items.length > 0 || hasHiddenItems;
  const itemsWithFiltered = items.concat(showAllItems ? filteredItems : []);

  if (!hasResults) {
    return <Empty />;
  }

  return (
    <Fragment>
      <Header>
        <SimilarSpectrum />
      </Header>

      <Panel>
        <Toolbar onMerge={onMerge} />

        <PanelBody>
          {itemsWithFiltered.map(item => (
            <Item
              key={item.issue.id}
              orgId={orgId}
              groupId={groupId}
              project={project}
              {...item}
            />
          ))}

          {hasHiddenItems && !showAllItems && (
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
