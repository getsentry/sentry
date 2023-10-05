import omit from 'lodash/omit';
import {PlatformIcon} from 'platformicons';

import FileSize from 'sentry/components/fileSize';
import useRouter from 'sentry/utils/useRouter';
import {BrowserStarfishFields} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

type Props = {
  description?: string;
  groupId?: string;
};

export function ResourceSidebar(props: Props) {
  const router = useRouter();
  const key = props.groupId;
  const description = props.description || props.groupId;
  return (
    <DetailPanel
      detailKey={key}
      onClose={() => {
        router.replace({
          pathname: router.location.pathname,
          query: omit(router.location.query, [BrowserStarfishFields.DESCRIPTION]),
        });
      }}
    >
      <PlatformIcon platform="javascript" />
      <h3>{description}</h3>
      <ResourceInfo />
      <div>Span samples, charts for duration overtime and size overtime</div>
    </DetailPanel>
  );
}

function ResourceInfo() {
  return (
    <BlockContainer>
      <Block title="Avg Duration" alignment="left">
        20.00ms
      </Block>
      <Block title="Resource Size" alignment="left">
        <FileSize bytes={200} />
      </Block>
    </BlockContainer>
  );
}
