import React from 'react';

import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TagsTableRow from 'sentry/components/tagsTableRow';
import {t} from 'sentry/locale';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function TagPanel() {
  const {replay} = useReplayContext();
  const event = replay?.getEvent();

  if (!event) {
    return <Placeholder height="400px" />;
  }

  const eventWithMeta = withMeta(event);
  const tags = eventWithMeta.tags;

  const query = '';
  const generateUrl = () => '';

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
