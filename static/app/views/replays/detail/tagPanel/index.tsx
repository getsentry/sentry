import {useCallback} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import EmptyMessage from 'sentry/components/emptyMessage';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import {Panel as BasePanel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function TagPanel() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  const generateUrl = useCallback(
    (name: string, value: string) =>
      ({
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
        query: {
          query: `${name}:"${value}"`,
        },
      } as LocationDescriptor),
    [organization.slug]
  );

  if (!replayRecord) {
    return <Placeholder testId="replay-tags-loading-placeholder" height="100%" />;
  }

  const tags = Object.entries(replayRecord.tags);

  return (
    <Panel>
      <FluidPanel>
        {tags.length ? (
          <KeyValueTable>
            {tags.map(([key, values]) => (
              <ReplayTagsTableRow
                key={key}
                name={key}
                values={values}
                generateUrl={generateUrl}
              />
            ))}
          </KeyValueTable>
        ) : (
          <EmptyMessage>{t('No tags for this replay were found.')}</EmptyMessage>
        )}
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
