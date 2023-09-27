import {Fragment} from 'react';
import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';

export default function FeedbackListWrapper({children}) {
  return (
    <Fragment>
      <HeaderPanelItem>fixed header</HeaderPanelItem>
      <OverflowPanelItem noPadding>{children}</OverflowPanelItem>
    </Fragment>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;
  padding: ${space(0.5)};

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(1)};
`;
