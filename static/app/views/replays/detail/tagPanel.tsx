import React from 'react';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {TagsTableRow} from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function TagPanel() {
  const {replay} = useReplayContext();
  const tags = replay?.getEvent().tags;

  const query = '';
  const generateUrl = () => '';

  if (!tags) {
    return <Placeholder height="400px" />;
  }

  return (
    <FluidPanel panel title={t('Tags')}>
      <KeyValueTable>
        {tags.map(tag => (
          <TagsTableRow key={tag.key} tag={tag} query={query} generateUrl={generateUrl} />
        ))}
      </KeyValueTable>
    </FluidPanel>
  );
}

export default TagPanel;
