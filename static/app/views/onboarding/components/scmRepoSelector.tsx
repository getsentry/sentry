import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import {useScmRepoSearch} from './useScmRepoSearch';
import {useScmRepoSelection} from './useScmRepoSelection';

export function ScmRepoSelector() {
  const {selectedIntegration, selectedRepository, setSelectedRepository} =
    useOnboardingContext();
  const selectedRepo = selectedRepository ?? null;

  const {reposByIdentifier, dropdownItems, isFetching, debouncedSearch, setSearch} =
    useScmRepoSearch(selectedIntegration?.id ?? '', selectedRepo);

  const {adding, handleSelect, handleRemove} = useScmRepoSelection({
    onSelect: setSelectedRepository,
    reposByIdentifier,
  });

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={false}
        options={dropdownItems}
        onChange={handleSelect}
        value={undefined}
        menuTitle={t('Repositories')}
        emptyMessage={
          isFetching
            ? t('Searching\u2026')
            : debouncedSearch
              ? t('No repositories found.')
              : t('Type to search repositories')
        }
        search={{
          placeholder: t('Search repositories'),
          filter: false,
          onChange: setSearch,
        }}
        loading={isFetching}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} busy={adding}>
            {selectedRepo ? selectedRepo.name : t('Search repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepo && (
        <Flex align="center" gap="sm">
          <Flex flexGrow={1}>
            <Text size="sm">{selectedRepo.name}</Text>
          </Flex>
          <Button
            size="zero"
            priority="link"
            icon={<IconClose size="xs" />}
            aria-label={t('Remove %s', selectedRepo.name)}
            onClick={handleRemove}
          />
        </Flex>
      )}
    </Stack>
  );
}
