import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';

export default Storybook.story('SCMOverviewSection', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="SCMOverviewSection" /> displays Source Code
        Management integration status in the Seer settings overview. It fetches SCM
        providers, installed integrations, and connected repositories to show a summary
        stat and actions.
      </p>
      <p>
        The component internally calls <code>useScmIntegrationTreeData()</code> to load
        data — the stories below illustrate each visual state by rendering the underlying{' '}
        <code>SeerOverview</code> primitives directly.
      </p>
    </Fragment>
  ));

  story('Loading', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <Text as="div" size="sm" variant="muted">
          {t('Loading…')}
        </Text>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('Error', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <Text as="div" size="sm" variant="muted">
          {t('Error loading repositories')}
        </Text>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('No supported integrations installed', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <Text as="div" size="sm">
          {t('add an integration')}
        </Text>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('Integration installed, provider has no accessible repos', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <SeerOverview.Stat
          value={SeerOverview.formatStatValue(0, 0, false)}
          label={tn('Repository', 'Repositories', 0)}
        />
        <SeerOverview.ActionButton>
          <Text size="sm" variant="muted">
            {t('Configure your provider to allow Sentry to see your repos.')}
          </Text>
        </SeerOverview.ActionButton>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('Integration installed, repos visible but none added to Sentry', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <SeerOverview.Stat
          value={SeerOverview.formatStatValue(0, 0, false)}
          label={tn('Repository', 'Repositories', 0)}
        />
        <SeerOverview.ActionButton>
          <Text size="sm" variant="muted">
            {tct('[github:Allow access] so Sentry can see your repos.', {
              github: <ExternalLink href="https://github.com/settings/installations" />,
            })}
          </Text>
        </SeerOverview.ActionButton>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('Some repos connected', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <SeerOverview.Stat
          value={SeerOverview.formatStatValue(3, 7, false)}
          label={tn('Repository', 'Repositories', 3)}
        />
        <SeerOverview.ActionButton>
          <Button priority="primary" size="xs" icon={<IconAdd />} disabled={false}>
            {t('Add all repos')}
          </Button>
        </SeerOverview.ActionButton>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));

  story('All repos connected', () => (
    <SeerOverview>
      <SeerOverview.Section>
        <SeerOverview.SectionHeader title={t('Source Code Management')} />
        <SeerOverview.Stat
          value={SeerOverview.formatStatValue(7, 7, false)}
          label={tn('Repository', 'Repositories', 7)}
        />
        <SeerOverview.ActionButton>
          <Button priority="primary" size="xs" icon={<IconAdd />} disabled>
            {t('Add all repos')}
          </Button>
        </SeerOverview.ActionButton>
        <div />
      </SeerOverview.Section>
    </SeerOverview>
  ));
});
