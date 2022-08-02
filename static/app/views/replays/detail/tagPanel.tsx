import React from 'react';
import styled from '@emotion/styled';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import {Panel as BasePanel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TagsTableRow from 'sentry/components/tagsTableRow';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function TagPanel() {
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  if (!replayRecord) {
    return <Placeholder height="100%" />;
  }

  const query = '';
  const generateUrl = () => '';

  return (
    <Panel>
      <FluidPanel>
        <KeyValueTable>
          {Object.entries(replayRecord.tags).map(([key, value]) => (
            <TagsTableRow
              key={key}
              tag={{key, value}}
              query={query}
              generateUrl={generateUrl}
            />
          ))}
        </KeyValueTable>
      </FluidPanel>
    </Panel>
  );
}

const Panel = styled(BasePanel)`
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin-bottom: 0;
`;

export default TagPanel;
