import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getInvestigationsPath} from 'sentry/views/investigations/utils';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function SeerSecondaryNavigationImpl() {
  const organization = useOrganization();
  const investigationsPath = getInvestigationsPath(organization.slug);

  useLLMContext({
    contextHint: 'The Seer secondary nav panel.',
    navItems: [{label: 'Investigations', badge: 'alpha', to: investigationsPath}],
  });

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Seer')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="seer-main">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={investigationsPath}
                analyticsItemName="seer_investigations"
                trailingItems={<FeatureBadge type="alpha" />}
              >
                {t('Investigations')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
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
