import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import EmptyMessage from 'sentry/components/emptyMessage';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {t} from 'sentry/locale';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import TagFilters from 'sentry/views/replays/detail/tagPanel/tagFilters';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

function TagPanel() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const tags = replayRecord?.tags;
  const sdkOptions = replay?.getSDKOptions();

  const tagsWithConfig = useMemo(() => {
    const unorderedTags = {
      ...tags,
      ...Object.fromEntries(
        Object.entries(sdkOptions ?? {}).map(
          ([key, value]) =>
            key === 'name' || key === 'version'
              ? ['sdk.' + key, [value]]
              : ['sdk.replay.' + key, [value]] // specify tags from the replay sdk; these tags are not searchable
        )
      ),
    };

    // Sort the tags by key
    const sortedTags = Object.keys(unorderedTags)
      .sort()
      .reduce((acc, key) => {
        acc[key] = unorderedTags[key];
        return acc;
      }, {});

    return sortedTags;
  }, [tags, sdkOptions]);

  const filterProps = useTagFilters({tags: tagsWithConfig || {}});
  const {items} = filterProps;

  const generateUrl = useCallback(
    (name: string, value: ReactNode): LocationDescriptor => ({
      pathname: normalizeUrl(`/organizations/${organization.slug}/replays/`),
      query: {
        // The replay index endpoint treats unknown filters as tags, by default. Therefore we don't need the tags[] syntax, whether `name` is a tag or not.
        query: `${name}:"${value}"`,
      },
    }),
    [organization.slug]
  );

  if (!replayRecord) {
    return <Placeholder testId="replay-tags-loading-placeholder" height="100%" />;
  }
  const filteredTags = Object.entries(items);

  return (
    <FluidHeight>
      <TagFilters tags={tags} {...filterProps} />
      <TabItemContainer>
        <StyledPanel>
          <FluidPanel>
            {filteredTags.length ? (
              <KeyValueTable noMargin>
                {filteredTags.map(([key, values]) => (
                  <ReplayTagsTableRow
                    key={key}
                    name={key}
                    values={values}
                    generateUrl={key.includes('sdk.replay.') ? undefined : generateUrl}
                  />
                ))}
              </KeyValueTable>
            ) : (
              <EmptyMessage>{t('No tags for this replay were found.')}</EmptyMessage>
            )}
          </FluidPanel>
        </StyledPanel>
      </TabItemContainer>
    </FluidHeight>
  );
}

const StyledPanel = styled('div')`
  position: relative;
  height: 100%;
  overflow: auto;
  display: grid;
`;

export default TagPanel;
