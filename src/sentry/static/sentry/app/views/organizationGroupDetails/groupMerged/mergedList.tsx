import React from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import QueryCount from 'app/components/queryCount';
import {t} from 'app/locale';
import {Item, Project} from 'app/types';

import MergedItem from './mergedItem';
import MergedToolbar from './mergedToolbar';

// XXX: How do I handle isRequired vs not?
type Props = {
  onUnmerge: Function;
  onToggleCollapse: Function;
  items: Item[];
  pageLinks: string;
  orgId: String;
  project: Project;
};

class MergedList extends React.Component<Props> {
  renderEmpty = () => (
    <EmptyStateWarning>
      <p>{t("There don't seem to be any hashes for this issue.")}</p>
    </EmptyStateWarning>
  );

  render() {
    const {items, pageLinks, onToggleCollapse, onUnmerge, orgId, project} = this.props;
    const itemsWithLatestEvent = items.filter(({latestEvent}) => !!latestEvent);
    const hasResults = itemsWithLatestEvent.length > 0;

    if (!hasResults) {
      return <Panel>{this.renderEmpty()}</Panel>;
    }

    return (
      <div>
        <h2>
          <span>{t('Merged fingerprints with latest event')}</span>{' '}
          <QueryCount count={itemsWithLatestEvent.length} />
        </h2>

        <MergedToolbar
          onToggleCollapse={onToggleCollapse}
          onUnmerge={onUnmerge}
          orgId={orgId}
          project={project}
        />

        <MergedItems>
          {itemsWithLatestEvent.map(({id, latestEvent}) => (
            <MergedItem
              key={id}
              orgId={orgId}
              projectId={project.slug}
              disabled={items.length === 1}
              event={latestEvent}
              fingerprint={id}
            />
          ))}
        </MergedItems>

        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
}

export default MergedList;

const MergedItems = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-top: none;
`;
