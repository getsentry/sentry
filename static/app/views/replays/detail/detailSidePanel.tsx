import React from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import TagsTable from 'sentry/components/tagsTable';
import space from 'sentry/styles/space';
import ReplayReader from 'sentry/utils/replays/replayReader';

import Breadcrumbs from './breadcrumbs';
import TabbedPanel from './tabbedPanel';

type Props = {
  replay: ReplayReader | null;
};

function DetailSidePanel({replay}: Props) {
  const placeholder = Array.from({length: 4}).map((_, i) => (
    <Placeholder key={i} height="40px" bottomGutter={1} />
  ));

  return (
    <TabbedPanel
      tabs={[
        {
          name: 'Breadcrumbs',
          render: (
            <Breadcrumbs crumbs={replay?.getRawCrumbs()} event={replay?.getEvent()} />
          ),
        },
        {
          name: 'Tags',
          render: (
            <TagsContainer>
              {replay ? (
                <TagsTable generateUrl={() => ''} event={replay.getEvent()} query="" />
              ) : (
                placeholder
              )}
            </TagsContainer>
          ),
        },
      ]}
    />
  );
}

const TagsContainer = styled('div')`
  padding: ${space(1.5)};
`;

export default DetailSidePanel;
