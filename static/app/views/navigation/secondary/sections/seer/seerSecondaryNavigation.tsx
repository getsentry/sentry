import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getClassifiersPath, useClassifiersEnabled} from 'sentry/views/classifiers/utils';
import {
  getInvestigationsPath,
  useInvestigationsEnabled,
} from 'sentry/views/investigations/utils';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  getAutomationsPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

function SeerSecondaryNavigationImpl() {
  const settingsV3 = useSettingsV3();
  const organization = useOrganization();
  const investigationsEnabled = useInvestigationsEnabled();
  const automationsEnabled = useAutomationsEnabled();
  const classifiersEnabled = useClassifiersEnabled();
  const investigationsPath = getInvestigationsPath(organization.slug);
  const automationsPath = getAutomationsPath(organization.slug);
  const classifiersPath = getClassifiersPath(organization.slug);

  useLLMContext({
    contextHint: 'The Seer secondary nav panel.',
    navItems: [
      ...(automationsEnabled
        ? [{label: 'Automations', badge: 'alpha', to: automationsPath}]
        : []),
      ...(investigationsEnabled
        ? [{label: 'Investigations', badge: 'alpha', to: investigationsPath}]
        : []),
      ...(classifiersEnabled
        ? [{label: 'Classifiers', badge: 'alpha', to: classifiersPath}]
        : []),
    ],
  });

  if (!investigationsEnabled && !automationsEnabled && !classifiersEnabled) {
    return null;
  }

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        <SecondaryNavigation.HeaderTitle>{t('Seer')}</SecondaryNavigation.HeaderTitle>
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="seer-main">
          <SecondaryNavigation.List>
            {automationsEnabled && (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={automationsPath}
                  analyticsItemName="seer_automations"
                  leadingItems={
                    settingsV3 ? <SecondaryNavigation.FeatureBadge type="alpha" /> : null
                  }
                  trailingItems={
                    settingsV3 ? null : <SecondaryNavigation.FeatureBadge type="alpha" />
                  }
                >
                  {t('Automations')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            )}
            {investigationsEnabled && (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={investigationsPath}
                  analyticsItemName="seer_investigations"
                  leadingItems={
                    settingsV3 ? <SecondaryNavigation.FeatureBadge type="alpha" /> : null
                  }
                  trailingItems={
                    settingsV3 ? null : <SecondaryNavigation.FeatureBadge type="alpha" />
                  }
                >
                  {t('Investigations')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            )}
            {classifiersEnabled && (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={classifiersPath}
                  analyticsItemName="seer_classifiers"
                  leadingItems={
                    settingsV3 ? <SecondaryNavigation.FeatureBadge type="alpha" /> : null
                  }
                  trailingItems={
                    settingsV3 ? null : <SecondaryNavigation.FeatureBadge type="alpha" />
                  }
                >
                  {t('Classifiers')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            )}
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

export const SeerSecondaryNavigation = registerLLMContext(
  'navigation',
  SeerSecondaryNavigationImpl
);
