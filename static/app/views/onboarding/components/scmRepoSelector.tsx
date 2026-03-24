import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useScmRepoSearch} from './useScmRepoSearch';
import {useScmRepoSelection} from './useScmRepoSelection';

interface ScmRepoSelectorProps {
  integration: Integration;
}

export function ScmRepoSelector({integration}: ScmRepoSelectorProps) {
  const organization = useOrganization();
  const {selectedRepository, setSelectedRepository} = useOnboardingContext();
  const {
    reposByIdentifier,
    dropdownItems,
    isFetching,
    isError,
    debouncedSearch,
    setSearch,
  } = useScmRepoSearch(integration.id, selectedRepository);

  const {busy, handleSelect, handleRemove} = useScmRepoSelection({
    integration,
    onSelect: repo => {
      setSelectedRepository(repo);
      if (repo) {
        trackAnalytics('onboarding.scm_connect_repo_selected', {
          organization,
          provider: integration.provider.key,
          repo: repo.name,
        });
      }
    },
    reposByIdentifier,
  });

  return (
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
        disabled={busy}
        options={dropdownItems}
        onChange={handleSelect}
        value={undefined}
        menuTitle={t('Repositories')}
        emptyMessage={
          isError
            ? t('Failed to search repositories. Please try again.')
            : isFetching
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
          <OverlayTrigger.Button {...triggerProps} busy={busy}>
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
            disabled={busy}
          />
        </Flex>
      )}
    </Stack>
  );
}
