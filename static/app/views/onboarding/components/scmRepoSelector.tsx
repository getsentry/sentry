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
  const {reposByIdentifier, dropdownItems, isFetching, debouncedSearch, setSearch} =
    useScmRepoSearch(selectedIntegration?.id ?? '', selectedRepository);

  const {adding, handleSelect, handleRemove} = useScmRepoSelection({
    onSelect: setSelectedRepository,
    reposByIdentifier,
  });

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={adding}
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
            {selectedRepository ? selectedRepository.name : t('Search repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepository && (
        <Flex align="center" gap="sm">
          <Flex flexGrow={1}>
            <Text size="sm">{selectedRepository.name}</Text>
          </Flex>
          <Button
            size="zero"
            priority="link"
            icon={<IconClose size="xs" />}
            aria-label={t('Remove %s', selectedRepository.name)}
            onClick={handleRemove}
            disabled={adding}
          />
        </Flex>
      )}
    </Stack>
  );
}
