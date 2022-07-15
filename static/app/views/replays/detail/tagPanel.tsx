import React from 'react';
import styled from '@emotion/styled';

import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import {
  Panel as BasePanel,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import TagsTableRow from 'sentry/components/tagsTableRow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function TagPanel() {
  const {replay} = useReplayContext();
  const event = replay?.getEvent();

  if (!event) {
    return <Placeholder height="100%" />;
  }

  const eventWithMeta = withMeta(event);
  const tags = eventWithMeta.tags;

  const query = '';
  const generateUrl = () => '';

  return (
    <Panel>
      <FluidPanel title={<PanelHeader>{t('Tags')}</PanelHeader>}>
        <KeyValueTable>
          {tags.map(tag => (
            <TagsTableRow
              key={tag.key}
              tag={tag}
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

const PanelHeader = styled(BasePanelHeader)`
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  text-transform: capitalize;
  padding: ${space(1)} ${space(1.5)} ${space(1)};
  font-weight: 600;
`;

export default TagPanel;
