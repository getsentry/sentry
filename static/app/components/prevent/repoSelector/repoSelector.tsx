import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import DropdownButton from 'sentry/components/dropdownButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {useInfiniteRepositories} from 'sentry/components/prevent/repoSelector/useInfiniteRepositories';
import {IconInfo, IconSync} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {IconRepository} from './iconRepository';
import {useSyncRepos} from './useSyncRepos';

function SyncRepoButton({searchValue}: {searchValue?: string}) {
  const {triggerResync, isSyncing} = useSyncRepos({searchValue});

  if (isSyncing) {
    return <StyledLoadingIndicator size={12} />;
  }

  return (
    <StyledButtonContainer>
      <StyledButton
        borderless
        aria-label={t('Sync Now')}
        onClick={() => triggerResync()}
        size="xs"
        icon={<IconSync />}
      >
        sync now
      </StyledButton>
    </StyledButtonContainer>
  );
}

interface MenuFooterProps {
  repoAccessLink: string;
}

function MenuFooter({repoAccessLink}: MenuFooterProps) {
  return (
    <FooterTip>
      <IconInfo size="xs" />
      <span>
        {tct(
          "Sentry only displays repos you've authorized. Manage [repoAccessLink] in your GitHub settings.",
          {
            // TODO: adjust link when backend gives specific GH installation
            repoAccessLink: <Link to={repoAccessLink}>repo access</Link>,
          }
        )}
      </span>
    </FooterTip>
  );
}

export function RepoSelector() {
  const {repository, integratedOrgId, preventPeriod, changeContextValue} =
    usePreventContext();
  const [displayedRepos, setDisplayedRepos] = useState<string[]>([]);

  const [searchValue, setSearchValue] = useState<string | undefined>();
  const {
    data: repositories,
    isFetching,
    isLoading,
  } = useInfiniteRepositories({term: searchValue});

  const disabled = !integratedOrgId;

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({
        integratedOrgId,
        preventPeriod,
        repository: selectedOption.value,
      });
    },
    [changeContextValue, integratedOrgId, preventPeriod]
  );

  const handleOnSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 300),
    [setSearchValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const repoSet = new Set([...(repository ? [repository] : []), ...displayedRepos]);

    return [...repoSet].map((value): SelectOption<string> => {
      return {
        // TODO: ideally this has a unique id, possibly adjust set to an
        // object when you have backend response
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    });
  }, [displayedRepos, repository]);

  function getEmptyMessage() {
    if (isFetching) {
      return t('Getting repositories...');
    }

    if (searchValue && !repositories?.length) {
      return t('No repositories found. Please enter at least 3 characters to search.');
    }

    return t('No repositories found');
  }

  useEffect(() => {
    // Only update displayedRepos if the hook returned something non-empty
    if (!isFetching) {
      setDisplayedRepos((repositories ?? []).map(item => item.name));
    }
  }, [isFetching, repositories]);

  useEffect(() => {
    // Create a use effect to cancel handleOnSearch fn on unmount to avoid memory leaks
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  return (
    <CompactSelect
      loading={isLoading}
      onSearch={handleOnSearch}
      searchable
      disableSearchFilter
      searchPlaceholder={t('search by repository name')}
      options={options}
      value={repository ?? ''}
      onChange={handleChange}
      onOpenChange={_ => setSearchValue(undefined)}
      menuWidth={'16rem'}
      menuBody={<SyncRepoButton searchValue={searchValue} />}
      menuFooter={<MenuFooter repoAccessLink="placeholder" />}
      disabled={disabled}
      emptyMessage={getEmptyMessage()}
      trigger={(triggerProps, isOpen) => {
        const defaultLabel = options.some(item => item.value === repository)
          ? repository
          : t('Select Repo');

        return (
          <DropdownButton
            isOpen={isOpen}
            data-test-id="page-filter-prevent-repository-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <Flex align="center" gap="sm">
                <IconContainer>
                  <IconRepository />
                </IconContainer>
                <TriggerLabel>{defaultLabel}</TriggerLabel>
              </Flex>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
    />
  );
}

const StyledButton = styled(Button)`
  display: inline-flex;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.muted};
  padding: ${space(1)};
  &:hover * {
    background-color: transparent;
    border-color: transparent;
  }
`;

const StyledButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(0.5)};
  margin: 0 ${space(0.5)} ${space(0.5)} 0;
`;

const FooterTip = styled('p')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  margin: 0;
`;

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  div {
    margin: 0;
  }
`;

const IconContainer = styled('div')`
  flex: 1 0 14px;
  height: 14px;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: ${p => p.theme.space.lg};
  }
`;
