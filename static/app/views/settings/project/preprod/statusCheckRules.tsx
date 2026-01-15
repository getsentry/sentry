import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import seerConfigBugSvg from 'sentry-images/spot/seer-config-bug-1.svg';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Switch} from 'sentry/components/core/switch';
import {Heading, Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useRepositories} from 'sentry/utils/useRepositories';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {StatusCheckRuleItem} from './statusCheckRuleItem';
import {useStatusCheckRules} from './useStatusCheckRules';

export function StatusCheckRules() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {data: repositories, isPending: isLoadingRepos} = useRepositories({
    orgSlug: organization.slug,
  });
  const {config, setEnabled, addRule, updateRule, deleteRule, createEmptyRule} =
    useStatusCheckRules(project);

  const [newRuleId, setNewRuleId] = useState<string | null>(null);

  const handleAddRule = () => {
    const newRule = createEmptyRule();
    addRule(newRule);
    setNewRuleId(newRule.id);
  };

  const hasRepositories = !isLoadingRepos && repositories && repositories.length > 0;

  return (
    <Panel>
      <PanelHeader>{t('Size Analysis - Status Checks')}</PanelHeader>
      <PanelBody>
        {hasRepositories ? (
          <Fragment>
            <Flex align="center" justify="between" padding="xl" borderBottom="primary">
              <Stack gap="xs">
                <Text size="lg" bold>
                  {t('Status Checks Enabled')}
                </Text>
                <Text size="sm" variant="muted">
                  {t("Sentry will post status checks based on your build's app size.")}
                </Text>
              </Stack>
              <Switch
                size="lg"
                checked={config.enabled}
                onChange={() => setEnabled(!config.enabled)}
                aria-label={t('Toggle status checks')}
              />
            </Flex>

            {config.enabled ? (
              <Fragment>
                {config.rules.length > 0 ? (
                  <Stack>
                    {config.rules.map(rule => (
                      <StatusCheckRuleItem
                        key={rule.id}
                        rule={rule}
                        defaultExpanded={rule.id === newRuleId}
                        onSave={updated => {
                          updateRule(rule.id, updated);
                          if (rule.id === newRuleId) {
                            setNewRuleId(null);
                          }
                        }}
                        onDelete={() => {
                          deleteRule(rule.id);
                          if (rule.id === newRuleId) {
                            setNewRuleId(null);
                          }
                        }}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Container
                    margin="md"
                    padding="xl"
                    background="secondary"
                    border="primary"
                    radius="md"
                    style={{borderStyle: 'dashed'}}
                  >
                    <Text align="center" variant="muted">
                      {t('No status check rules configured. Create one to get started.')}
                    </Text>
                  </Container>
                )}

                <Flex padding="lg xl" borderTop="primary">
                  <AddRuleButton icon={<IconAdd />} onClick={handleAddRule}>
                    {t('Create Status Check Rule')}
                  </AddRuleButton>
                </Flex>
              </Fragment>
            ) : (
              <Container padding="md">
                <Text align="center" variant="muted" italic>
                  {t('Enable status checks above to configure rules.')}
                </Text>
              </Container>
            )}
          </Fragment>
        ) : (
          <EmptyStateContainer>
            <ContentWrapper>
              <Heading as="h3">{t('Get the most out of Size Analysis')}</Heading>
              <Text>
                {t('Connect at least one repository to get Size Analysis status checks')}
              </Text>
              <LinkButton to={`/settings/${organization.slug}/repos/`} priority="primary">
                {t('Add Repo')}
              </LinkButton>
            </ContentWrapper>
            <ImageContainer />
          </EmptyStateContainer>
        )}
      </PanelBody>
    </Panel>
  );
}

const AddRuleButton = styled(Button)`
  align-self: flex-start;
`;

const EmptyStateContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 56px 48px;
  gap: ${p => p.theme.space.xl};
`;

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${p => p.theme.space.lg};
`;

const ImageContainer = styled('div')`
  width: 220px;
  height: 220px;
  background-image: url(${seerConfigBugSvg});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  flex-shrink: 0;
`;
