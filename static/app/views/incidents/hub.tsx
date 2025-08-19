import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

import beamImage from 'sentry-images/spot/inc-mgmt-empty-state.svg';

import {Button} from 'sentry/components/core/button/';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Grid} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SetupWizard} from 'sentry/views/incidents/components/setupWizard';
import {animations} from 'sentry/views/incidents/styles';

export default function IncidentHub() {
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(true);

  return (
    <Layout.Page>
      <SentryDocumentTitle title={t('Incident Hub')} />
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>{t('Incident Hub')}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <Flex direction="column" gap="lg">
            <AnimatePresence mode="wait">
              {isSetupWizardOpen ? (
                <motion.div key="wizard" {...animations.moveOver}>
                  <SetupWizard onAbandon={() => setIsSetupWizardOpen(false)} />
                </motion.div>
              ) : (
                <motion.div key="content" {...animations.moveOver}>
                  <IncidentHubBanner onStartSetup={() => setIsSetupWizardOpen(true)} />
                </motion.div>
              )}
            </AnimatePresence>
          </Flex>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function IncidentHubBanner({onStartSetup}: {onStartSetup: () => void}) {
  return (
    <Grid
      columns="auto 1fr"
      border="primary"
      radius="md"
      padding="lg"
      gap="lg"
      align="center"
      justify="center"
    >
      <img src={beamImage} alt="Sentrypulled away from leisure time" style={{flex: 1}} />
      <Flex direction="column" gap="sm" justify="center" padding="xl">
        <h3>
          {t('When the beam hits,')}
          <br />
          {t('have as plan.')}
        </h3>
        <p>
          {t(
            "Preparation beats panic. Sentry's got your back with a suite of incident management tools."
          )}
        </p>
        <ButtonBar>
          <Button priority="primary" onClick={onStartSetup}>
            {t('Setup Incident Management')}
          </Button>
          <LinkButton href={'https://docs.sentry.io/'} external>
            {t('Read Docs')}
          </LinkButton>
        </ButtonBar>
      </Flex>
    </Grid>
  );
}
