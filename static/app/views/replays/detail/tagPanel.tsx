import React from 'react';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import {TagsTableRow} from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

type Props = {
  replay: ReplayReader;
};

function TagPanel({replay}: Props) {
  const tags = replay.getEvent().tags;

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
