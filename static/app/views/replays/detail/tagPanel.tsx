import React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import {
  Panel as BasePanel,
  PanelBody as BasePanelBody,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import TagsTable from 'sentry/components/tagsTable';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import ReplayReader from 'sentry/utils/replays/replayReader';

type Props = {
  replay: ReplayReader;
};

const TAB_HEADER_HEIGHT = 28;

function TagPanel({replay}: Props) {
  return (
    <Panel>
      <PanelHeader>{t('Tags')}</PanelHeader>
      <PanelBody>
        <TagsTable generateUrl={() => ''} event={replay.getEvent()} query="" />
      </PanelBody>
    </Panel>
  );
}

const Panel = styled(BasePanel)`
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const PanelHeader = styled(BasePanelHeader)`
  background-color: ${p => p.theme.background};
  border-bottom: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  text-transform: capitalize;
  padding: ${space(1.5)} ${space(2)} ${space(0.5)};
`;

const PanelBody = styled(BasePanelBody)`
  padding: ${space(1.5)};
  overflow-y: auto;
  max-height: calc(100% - ${TAB_HEADER_HEIGHT}px);
  ${SectionHeading} {
    display: none;
  }
`;

export default TagPanel;
