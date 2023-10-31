import {ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import EmptyMessage from 'sentry/components/emptyMessage';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import TabItemContainer from 'sentry/views/replays/detail/tabItemContainer';
import TagFilters from 'sentry/views/replays/detail/tagPanel/tagFilters';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

const notTags = [
  'browser.name',
  'browser.version',
  'device.brand',
  'device.family',
  'device.model_id',
  'device.name',
  'platform',
  'releases',
  'replayType',
  'os.name',
  'os.version',
  'sdk.name',
  'sdk.version',
  'user.email',
  'user.username',
  // TODO(replay): Remove this when backend changes `name` -> `username`
  'user.name',
  'user.id',
  'user.ip',
];
const notSearchable = [
  'sdk.blockAllMedia',
  'sdk.errorSampleRate ',
  'sdk.maskAllInputs',
  'sdk.maskAllText',
  'sdk.networkCaptureBodies',
  'sdk.networkDetailHasUrls',
  'sdk.networkRequestHasHeaders',
  'sdk.networkResponseHasHeaders',
  'sdk.sessionSampleRate',
  'sdk.useCompression',
  'sdk.useCompressionOption',
];

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
        Object.entries(sdkOptions ?? {}).map(([key, value]) => ['sdk.' + key, [value]])
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
        query: notTags.includes(name)
          ? `${name}:"${value}"`
          : `tags["${name}"]:"${value}"`,
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
                    generateUrl={notSearchable.includes(key) ? undefined : generateUrl}
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
