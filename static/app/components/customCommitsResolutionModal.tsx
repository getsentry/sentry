import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ResolvedStatusDetails} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';

interface CustomCommitsResolutionModalProps extends ModalRenderProps {
  onSelected: (x: ResolvedStatusDetails) => void;
  orgSlug: string;
  projectSlug?: string;
}

function CustomCommitsResolutionModal({
  onSelected,
  orgSlug,
  projectSlug,
  closeModal,
  Header,
  Body,
  Footer,
}: CustomCommitsResolutionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [commit, setCommit] = useState<Commit | undefined>();

  const debouncedSetSearch = useMemo(
    () =>
      debounce(newSearch => {
        setSearchQuery(newSearch);
      }, 250),
    []
  );

  const {data: commits, isPending} = useApiQuery<Commit[]>(
    [
      `/projects/${orgSlug}/${projectSlug}/commits/`,
      {
        query: {
          query: searchQuery,
        },
      },
    ],
    {staleTime: 30_000, placeholderData: keepPreviousData}
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSelected({
      inCommit: {
        commit: commit?.id,
        repository: commit?.repository?.name,
      },
    });
    closeModal();
  };

  return (
    <form onSubmit={onSubmit}>
      <Header>
        <h4>{t('Resolved In')}</h4>
      </Header>
      <Body>
        <Flex>
          <StyledCompactSelect
            searchable
            value={commit?.id ?? ''}
            onChange={selectedOption => {
              setCommit(commits?.find(result => result.id === selectedOption.value));
            }}
            options={
              commits?.map(
                (c): SelectOption<string> => ({
                  value: c.id,
                  textValue: c.id,
                  label: <Version version={c.id} anchor={false} />,
                  details: (
                    <span>
                      {t('Created')} <TimeSince date={c.dateCreated} />
                    </span>
                  ),
                })
              ) ?? []
            }
            searchPlaceholder={t('e.g. d86b832')}
            loading={isPending}
            onSearch={debouncedSetSearch}
            triggerLabel={
              commit ? <Version version={commit.id} anchor={false} /> : t('Select Commit')
            }
          />
        </Flex>
      </Body>
      <Footer>
        <Button
          css={css`
            margin-right: ${space(1.5)};
          `}
          onClick={closeModal}
        >
          {t('Cancel')}
        </Button>
        <Button type="submit" priority="primary">
          {t('Resolve')}
        </Button>
      </Footer>
    </form>
  );
}

export default CustomCommitsResolutionModal;

const StyledCompactSelect = styled(CompactSelect)`
  flex-grow: 1;

  > button {
    width: 100%;
  }
`;
