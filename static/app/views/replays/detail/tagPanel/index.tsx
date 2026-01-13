import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Stack} from '@sentry/scraps/layout';

import EmptyMessage from 'sentry/components/emptyMessage';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import TagFilters from 'sentry/views/replays/detail/tagPanel/tagFilters';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

export default function TagPanel() {
  const organization = useOrganization();
  const replay = useReplayReader();
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[key] = unorderedTags[key];
        return acc;
      }, {});

    return sortedTags;
  }, [tags, sdkOptions]);

  const filterProps = useTagFilters({tags: tagsWithConfig || {}});
  const {items} = filterProps;

  const generateUrl = useCallback(
    (name: string, value: string): LocationDescriptor => ({
      pathname: makeReplaysPathname({
        path: '/',
        organization,
      }),
      query: {
        // The replay index endpoint treats unknown filters as tags, by default. Therefore we don't need the tags[] syntax, whether `name` is a tag or not.
        query: `${name}:"${value}"`,
      },
    }),
    [organization]
  );

  if (!replayRecord) {
    return <PaddedPlaceholder testId="replay-tags-loading-placeholder" height="100%" />;
  }
  const filteredTags = Object.entries(items);

  return (
    <Stack wrap="nowrap" minHeight="0">
      <TagFilters tags={tags} {...filterProps} />
      <TabItemContainer>
        <OverflowBody>
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
        </OverflowBody>
      </TabItemContainer>
    </Stack>
  );
}

const PaddedPlaceholder = styled(Placeholder)`
  padding-top: ${space(1)};
`;

const OverflowBody = styled('section')`
  flex: 1 1 auto;
  overflow: auto;
`;
