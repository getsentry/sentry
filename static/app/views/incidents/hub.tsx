import {useSearchParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import {AnimatePresence, motion} from 'framer-motion';

import beamImage from 'sentry-images/spot/inc-mgmt-empty-state.svg';

import {Button} from 'sentry/components/core/button/';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Grid} from 'sentry/components/core/layout';
import useDrawer from 'sentry/components/globalDrawer';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {IncidentCaseList} from 'sentry/views/incidents/caseList';
import {CaseDrawer} from 'sentry/views/incidents/components/caseDrawer';
import {useIncidentCaseTemplates} from 'sentry/views/incidents/hooks/useIncidentCaseTemplates';
import {animations} from 'sentry/views/incidents/styles';
import {SetupWizard} from 'sentry/views/incidents/wizard/setupWizard';

export default function IncidentHub() {
  const organization = useOrganization();
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const {incidentCaseTemplate} = useIncidentCaseTemplates({
    organizationSlug: organization.slug,
  });
  const {openDrawer, closeDrawer} = useDrawer();

  return (
    <Layout.Page>
      <SentryDocumentTitle title={t('Incident Hub')} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Flex justify="between" align="center">
            <Layout.Title>{t('Incident Hub')}</Layout.Title>
            {searchParams.get('setup') && (
              <Button
                borderless
                onClick={() => setSearchParams({})}
                size="xs"
                color={theme.tokens.content.muted}
              >
                {t('Abandon Setup')}
              </Button>
            )}
            {incidentCaseTemplate && (
              <Button
                icon={<IconFire />}
                size="sm"
                style={{color: theme.tokens.content.danger}}
                onClick={() =>
                  openDrawer(
                    () => (
                      <CaseDrawer template={incidentCaseTemplate} onClose={closeDrawer} />
                    ),
                    {
                      ariaLabel: t('Incident Case Creator'),
                      closeOnOutsideClick: false,
                    }
                  )
                }
              >
                {t('Declare Incident')}
              </Button>
            )}
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          {searchParams.get('setup') || !incidentCaseTemplate ? (
            <IncidentHubWelcome />
          ) : (
            <IncidentCaseList template={incidentCaseTemplate} />
          )}
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

function IncidentHubWelcome() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <Flex direction="column" gap="lg">
      <AnimatePresence mode="wait">
        {searchParams.get('setup') ? (
          <motion.div key="wizard" {...animations.moveOver}>
            <SetupWizard />
          </motion.div>
        ) : (
          <motion.div key="content" {...animations.moveOver}>
            <Grid
              columns="auto 1fr"
              border="primary"
              radius="md"
              padding="lg"
              gap="lg"
              align="center"
              justify="center"
            >
              <img
                src={beamImage}
                alt="Sentry pulled away from leisure time"
                style={{flex: 1}}
              />
              <Flex direction="column" gap="sm" justify="center" padding="xl">
                <h3>
                  {t('When the beam hits,')}
                  <br />
                  {t('have a plan.')}
                </h3>
                <p>
                  {t(
                    "Preparation beats panic. Sentry's got your back with a suite of incident management tools."
                  )}
                </p>
                <ButtonBar>
                  <Button
                    priority="primary"
                    onClick={() => setSearchParams({setup: 'true'})}
                  >
                    {t('Setup Incident Management')}
                  </Button>
                  <LinkButton href={'https://docs.sentry.io/'} external>
                    {t('Read Docs')}
                  </LinkButton>
                </ButtonBar>
              </Flex>
            </Grid>
          </motion.div>
        )}
      </AnimatePresence>
    </Flex>
  );
}
