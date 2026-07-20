import {Fragment, useMemo, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {IconAdd, IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {Organization} from 'sentry/types/organization';
import {FeatureFlagOverrides} from 'sentry/utils/featureFlagOverrides';
import {
  addOrganizationFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import {useOrganization} from 'sentry/utils/useOrganization';

import {CMDKAction} from './cmdk';

interface AddOrgFeatureFlagModalProps extends ModalRenderProps {
  onSubmit: (name: string, value: boolean) => void;
}

export function setLocalFeatureFlagOverride(
  organization: Organization,
  name: string,
  value: boolean
) {
  FeatureFlagOverrides.singleton().setStoredOverride(name, value);

  const features = new Set(organization.features);
  if (value) {
    features.add(name);
  } else {
    features.delete(name);
  }

  const updatedOrganization = {
    ...organization,
    features: Array.from(features),
  };
  addOrganizationFeaturesHandler({
    organization: updatedOrganization,
    handler: buildSentryFeaturesHandler('feature.organizations:'),
  });
  OrganizationStore.onUpdate(updatedOrganization, {replace: true});
}

function setLocalFeatureFlagOverrideWithFeedback(
  organization: Organization,
  name: string,
  value: boolean
) {
  setLocalFeatureFlagOverride(organization, name, value);
  addSuccessMessage(
    value
      ? t('Enabled local feature flag override: %s', name)
      : t('Disabled local feature flag override: %s', name)
  );
}

function AddOrgFeatureFlagModal({
  Body,
  Footer,
  Header,
  closeModal,
  onSubmit,
}: AddOrgFeatureFlagModalProps) {
  const [name, setName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const normalizedName = name.trim().toLowerCase();

  const submit = () => {
    if (!normalizedName) {
      return;
    }
    onSubmit(normalizedName, isEnabled);
    closeModal();
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4" size="md">
          {t('Add Org Feature Flag')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Input
            aria-label={t('Feature flag name')}
            autoFocus
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                submit();
              }
            }}
            placeholder={t('Feature flag name')}
            value={name}
          />
          <Flex align="center" gap="md">
            <Switch
              aria-label={t('Feature flag enabled')}
              checked={isEnabled}
              onChange={() => setIsEnabled(value => !value)}
            />
            <Text>{isEnabled ? t('Enabled') : t('Disabled')}</Text>
          </Flex>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button disabled={!normalizedName} onClick={submit} variant="primary">
            {t('Add Feature Flag')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

export function FeatureFlagCommandPaletteActions() {
  const organization = useOrganization();
  const [overrides, setOverrides] = useState(() =>
    FeatureFlagOverrides.singleton().getStoredOverrides()
  );
  const {enabledFlags, featureStateKey, flagNames} = useMemo(() => {
    const names = Array.from(
      new Set([...organization.features, ...Object.keys(overrides)])
    ).sort((a, b) => a.localeCompare(b));
    const enabled = new Set(organization.features);
    Object.entries(overrides).forEach(([name, value]) => {
      if (value) {
        enabled.add(name);
      } else {
        enabled.delete(name);
      }
    });

    return {
      enabledFlags: enabled,
      featureStateKey: names
        .map(name => `${name}:${enabled.has(name) ? '1' : '0'}`)
        .join(','),
      flagNames: names,
    };
  }, [organization.features, overrides]);

  const setOverride = (name: string, value: boolean) => {
    setLocalFeatureFlagOverrideWithFeedback(organization, name, value);
    setOverrides(current => ({...current, [name]: value}));
  };

  return (
    <CMDKAction
      display={{label: t('Feature Flags'), icon: <IconFlag />}}
      keywords={[t('features'), t('flags'), t('override'), t('toggle')]}
    >
      <CMDKAction
        display={{label: t('Toggle Org Feature Flag'), icon: <IconFlag />}}
        prompt={t('Search for a feature flag...')}
        resource={(_query, {state}) =>
          // `featureStateKey` represents `flagNames` and `enabledFlags`.
          // eslint-disable-next-line @tanstack/query/exhaustive-deps
          cmdkQueryOptions({
            queryKey: [
              'cmdk-admin-feature-flag-toggle',
              organization.slug,
              featureStateKey,
            ],
            queryFn: () =>
              flagNames.map(name => {
                const isEnabled = enabledFlags.has(name);
                return {
                  display: {
                    label: name,
                    icon: <IconFlag />,
                    trailingItem: (
                      <Tag variant={isEnabled ? 'success' : 'muted'}>
                        {isEnabled ? t('Enabled') : t('Disabled')}
                      </Tag>
                    ),
                  },
                  keywords: [name, isEnabled ? t('enabled') : t('disabled')],
                  onAction: () => setOverride(name, !isEnabled),
                };
              }),
            enabled: state === 'selected',
            staleTime: Infinity,
          })
        }
      />
      <CMDKAction
        display={{label: t('Add Feature Flag'), icon: <IconAdd />}}
        keywords={[t('new flag'), t('create flag'), t('override')]}
        onAction={() =>
          openModal(modalProps => (
            <AddOrgFeatureFlagModal {...modalProps} onSubmit={setOverride} />
          ))
        }
      />
    </CMDKAction>
  );
}
