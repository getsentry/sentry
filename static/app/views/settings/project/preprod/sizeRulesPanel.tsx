import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import seerConfigBugSvg from 'sentry-images/spot/seer-config-bug-1.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRepositories} from 'sentry/utils/useRepositories';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import type {RuleFormCopy} from './statusCheckRuleForm';
import {StatusCheckRuleItem} from './statusCheckRuleItem';
import type {StatusCheckRule} from './types';
import {type SizeRulesConfig, useSizeRules} from './useSizeRules';

interface SizeRulesPanelConfig {
  analytics: {
    onCreate: () => void;
    onDelete: () => void;
    onUpdate: (rule: StatusCheckRule) => void;
  };
  copy: {
    addRuleButtonLabel: string;
    connectRepoText: string;
    disabledHintText: string;
    emptyRulesText: string;
    enabledDescription: string;
    enabledLabel: string;
    form: RuleFormCopy;
    panelTitle: string;
    toggleAriaLabel: string;
  };
  rules: SizeRulesConfig;
}

interface Props {
  config: SizeRulesPanelConfig;
}

export function SizeRulesPanel({config: panelConfig}: Props) {
  const {copy, analytics} = panelConfig;
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const location = useLocation();
  const navigate = useNavigate();
  const {data: repositories, isPending: isLoadingRepos} = useRepositories({
    orgSlug: organization.slug,
  });
  const {config, setEnabled, addRule, updateRule, deleteRule, createEmptyRule} =
    useSizeRules(project, panelConfig.rules);

  const [newRuleId, setNewRuleId] = useState<string | null>(null);

  const expandedRuleIds = useMemo(() => {
    const expanded = location.query.expanded;
    if (!expanded) {
      return new Set<string>();
    }
    return new Set(Array.isArray(expanded) ? expanded : [expanded]);
  }, [location.query.expanded]);

  const updateExpandedInUrl = useCallback(
    (expandedIds: string[]) => {
      navigate(
        {
          query: {
            ...location.query,
            expanded: expandedIds,
          },
        },
        {replace: true}
      );
    },
    [location.query, navigate]
  );

  const handleAddRule = () => {
    const newRule = createEmptyRule();
    addRule(newRule);
    analytics.onCreate();
    setNewRuleId(newRule.id);
    updateExpandedInUrl([...expandedRuleIds, newRule.id]);
  };

  const handleToggleExpanded = (ruleId: string, isExpanded: boolean) => {
    const newExpanded = new Set(expandedRuleIds);
    if (isExpanded) {
      newExpanded.add(ruleId);
    } else {
      newExpanded.delete(ruleId);
      if (ruleId === newRuleId) {
        setNewRuleId(null);
      }
    }
    updateExpandedInUrl([...newExpanded]);
  };

  const hasRepositories = !isLoadingRepos && repositories && repositories.length > 0;

  return (
    <Panel>
      <PanelHeader>{copy.panelTitle}</PanelHeader>
      <PanelBody>
        {hasRepositories ? (
          <Fragment>
            <Flex align="center" justify="between" padding="xl" borderBottom="primary">
              <Stack gap="xs">
                <Text size="lg" bold>
                  {copy.enabledLabel}
                </Text>
                <Text size="sm" variant="muted">
                  {copy.enabledDescription}
                </Text>
              </Stack>
              <Switch
                size="lg"
                checked={config.enabled}
                onChange={() => setEnabled(!config.enabled)}
                aria-label={copy.toggleAriaLabel}
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
                        formCopy={copy.form}
                        isExpanded={rule.id === newRuleId || expandedRuleIds.has(rule.id)}
                        onToggleExpanded={isExpanded =>
                          handleToggleExpanded(rule.id, isExpanded)
                        }
                        onSave={updated => {
                          updateRule(rule.id, updated);
                          analytics.onUpdate(updated);
                          if (rule.id === newRuleId) {
                            setNewRuleId(null);
                          }
                        }}
                        onDelete={() => {
                          analytics.onDelete();
                          deleteRule(rule.id);
                          if (rule.id === newRuleId) {
                            setNewRuleId(null);
                          }
                          const newExpanded = new Set(expandedRuleIds);
                          newExpanded.delete(rule.id);
                          updateExpandedInUrl([...newExpanded]);
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
                      {copy.emptyRulesText}
                    </Text>
                  </Container>
                )}

                <Flex padding="lg xl" borderTop="primary" align="start">
                  <Button icon={<IconAdd />} onClick={handleAddRule}>
                    {copy.addRuleButtonLabel}
                  </Button>
                </Flex>
              </Fragment>
            ) : (
              <Container padding="md">
                <Text align="center" variant="muted" italic>
                  {copy.disabledHintText}
                </Text>
              </Container>
            )}
          </Fragment>
        ) : (
          <Grid columns="1fr auto" align="center" gap="xl" style={{padding: '56px 48px'}}>
            <Stack align="start" gap="lg">
              <Heading as="h3">{t('Get the most out of Size Analysis')}</Heading>
              <Text>{copy.connectRepoText}</Text>
              <LinkButton to={`/settings/${organization.slug}/repos/`} variant="primary">
                {t('Add Repo')}
              </LinkButton>
            </Stack>
            <ImageContainer />
          </Grid>
        )}
      </PanelBody>
    </Panel>
  );
}

const ImageContainer = styled('div')`
  width: 220px;
  height: 220px;
  background-image: url(${seerConfigBugSvg});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  flex-shrink: 0;
`;
