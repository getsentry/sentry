import {useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  functionUrl,
  lambdaUrl,
  MockBadge,
  ReinstrumentButton,
  SectionTitle,
} from 'sentry/views/insights/awsLambda/components';
import {useTimeQuery} from 'sentry/views/insights/awsLambda/hooks';
import {
  ACCOUNTS,
  COVERAGE,
  type CoverageRow,
  DEFAULT_RULES,
  type InstrumentationStatus,
  ruleMatches,
  STATUS_LABELS,
} from 'sentry/views/insights/awsLambda/mockData';
import {mockActions, useMockStore} from 'sentry/views/insights/awsLambda/mockStore';
import {AWS_LAMBDA_TITLE} from 'sentry/views/insights/awsLambda/views/overview';
import {TopBar} from 'sentry/views/navigation/topBar';

type LayerPolicy = 'pinned' | 'patch' | 'latest';

const SNIPPETS = {
  cli: `# Instrument functions in place (no redeploy). --dry prints the changes.
sentry-cli lambda instrument \\
  --region eu-north-1 \\
  --functions-regex '^(checkout|orders)-' \\
  --extension --traces-sample-rate 0.2 \\
  --release-from-git --dry

# Undo everything Sentry added
sentry-cli lambda uninstrument --region eu-north-1 -f checkout-api

# Bundle config, layers and recent logs for support
sentry-cli lambda flare -f orders-worker --with-logs`,
  cdk: `import {SentryLambda} from '@sentry/aws-cdk';

new SentryLambda(this, 'Sentry', {
  dsn: secrets.sentryDsn,
  extension: true,
  tracesSampleRate: 0.2,
  release: process.env.GIT_SHA, // also creates a deploy per Lambda version
}).addLambdaFunctions([checkoutApi, ordersWorker]);`,
  terraform: `module "orders_worker" {
  source  = "getsentry/lambda-sentry/aws"
  version = "~> 1.0"

  function_name = "orders-worker"
  runtime       = "python3.13"
  handler       = "worker.handler"

  sentry_dsn                = var.sentry_dsn
  sentry_extension          = true
  sentry_traces_sample_rate = 0.2
}`,
  container: `FROM public.ecr.aws/lambda/python:3.13

# Sentry Lambda extension + Python SDK, same versions as the layers
COPY --from=ghcr.io/getsentry/lambda-extension:4 /opt/extensions /opt/extensions
RUN pip install "sentry-sdk==3.0.0"

ENV SENTRY_INITIAL_HANDLER=app.handler
CMD ["sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler"]`,
};

/** What remote instrumentation would do with a function under the current rules. */
function planFor(
  row: CoverageRow,
  rules: string[]
): {reason: string; status: InstrumentationStatus} {
  if (row.instrumentation === 'unsupported') {
    return {
      status: 'unsupported',
      reason: t('Lambda@Edge functions can’t get layers after replication'),
    };
  }
  const exclusion = rules.find(
    rule => rule.trim().startsWith('!') && !ruleMatches(rule, row)
  );
  if (exclusion) {
    return {status: 'excluded', reason: t('Excluded by %s', exclusion.trim())};
  }
  const match = rules.find(
    rule => rule.trim() && !rule.trim().startsWith('!') && ruleMatches(rule, row)
  );
  if (row.instrumentation === 'manual') {
    return {
      status: 'manual',
      reason: t('Has Sentry layers no rule added, so rules leave it alone'),
    };
  }
  if (!match) {
    return {
      status: 'not-instrumented',
      reason: row.runtime.startsWith('provided')
        ? t('No rule matches. Custom runtime: extension only (OTLP)')
        : t('No rule matches'),
    };
  }
  if (row.instrumentation === 'drift') {
    return {
      status: 'drift',
      reason: t(
        'Matches %s; layers were removed by a deploy 3 hours ago, restoring on next sync',
        match
      ),
    };
  }
  return {status: 'rule', reason: t('Matches %s', match)};
}

export default function AwsLambdaInstrumentation() {
  const organization = useOrganization();
  const timeQuery = useTimeQuery();
  const [policy, setPolicy] = useState<LayerPolicy>('patch');
  const [rules, setRules] = useState(DEFAULT_RULES);
  const {instrumentation: overrides} = useMockStore();
  const plans = COVERAGE.map(base => {
    const row = {...base, instrumentation: overrides[base.name] ?? base.instrumentation};
    return {row, ...planFor(row, rules)};
  });
  const counts = plans.reduce<Record<string, number>>(
    (acc, plan) => ({...acc, [plan.status]: (acc[plan.status] ?? 0) + 1}),
    {}
  );

  return (
    <SentryDocumentTitle
      title={`${t('Instrumentation')} · ${AWS_LAMBDA_TITLE}`}
      orgSlug={organization.slug}
    >
      <Layout.Title>
        <Flex align="center" gap="sm">
          <Link to={{pathname: lambdaUrl(organization), query: timeQuery}}>
            {AWS_LAMBDA_TITLE}
          </Link>
          <Text variant="muted">/</Text>
          {t('Instrumentation')}
        </Flex>
      </Layout.Title>
      <TopBar.Slot name="actions">
        <Button
          size="sm"
          variant="primary"
          icon={<IconAdd />}
          disabled
          tooltipProps={{
            title: t(
              'Mock: launches the CloudFormation stack for a new account and region'
            ),
          }}
        >
          {t('Connect AWS account')}
        </Button>
      </TopBar.Slot>
      <Layout.Body>
        <Layout.Main width="full">
          <Stack gap="xl">
            <Flex>
              <MockBadge />
            </Flex>
            <Text variant="muted">
              {t(
                'Remote instrumentation keeps every matching function instrumented: a small stack in each AWS account and region watches CloudTrail, adds the Sentry SDK and extension layers to functions that match a rule, and repairs them when a deploy removes them. Functions instrumented by hand are left alone.'
              )}
            </Text>

            <Stack gap="md">
              <SectionTitle source="integration">{t('AWS accounts')}</SectionTitle>
              <AccountsTable>
                <SimpleTable.Header>
                  <SimpleTable.HeaderCell>{t('Account')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Region')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Stack')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Functions')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Instrumented')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Last sync')}</SimpleTable.HeaderCell>
                </SimpleTable.Header>
                {ACCOUNTS.map(account => (
                  <SimpleTable.Row key={`${account.account}-${account.region}`}>
                    <SimpleTable.RowCell>
                      <Stack gap="0">
                        <Text bold>{account.alias}</Text>
                        <Text size="xs" monospace variant="muted">
                          {account.account}
                        </Text>
                      </Stack>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <Text monospace size="sm">
                        {account.region}
                      </Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <Tag
                        variant={
                          account.stack.endsWith('COMPLETE') ? 'success' : 'warning'
                        }
                      >
                        {account.stack}
                      </Tag>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="end">
                      <Text tabular>{account.discovered}</Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="end">
                      <Text tabular>{account.instrumented}</Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <Text size="sm" variant="muted">
                        {account.lastSync}
                      </Text>
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                ))}
              </AccountsTable>
            </Stack>

            <Grid columns={{xs: '1fr', lg: '3fr 2fr'}} gap="xl">
              <Stack gap="md">
                <SectionTitle
                  actions={
                    <Button
                      size="xs"
                      icon={<IconAdd />}
                      onClick={() => setRules([...rules, ''])}
                    >
                      {t('Add rule')}
                    </Button>
                  }
                >
                  {t('Rules')}
                </SectionTitle>
                <Stack gap="sm">
                  {rules.map((rule, index) => {
                    const matched = rule.trim()
                      ? COVERAGE.filter(row =>
                          rule.trim().startsWith('!')
                            ? !ruleMatches(rule, row)
                            : ruleMatches(rule, row)
                        ).length
                      : 0;
                    return (
                      <Flex key={index} gap="sm" align="center">
                        <RuleInput
                          size="sm"
                          value={rule}
                          placeholder="team:checkout AND runtime:python*"
                          onChange={event =>
                            setRules(
                              rules.map((r, i) => (i === index ? event.target.value : r))
                            )
                          }
                        />
                        <Tag variant={rule.trim().startsWith('!') ? 'muted' : 'info'}>
                          {rule.trim().startsWith('!')
                            ? t('excludes %s', matched)
                            : t('matches %s', matched)}
                        </Tag>
                        <Button
                          size="xs"
                          icon={<IconDelete />}
                          aria-label={t('Remove rule')}
                          onClick={() => setRules(rules.filter((_, i) => i !== index))}
                        />
                      </Flex>
                    );
                  })}
                </Stack>
                <Text size="xs" variant="muted">
                  {t(
                    'Match on name, team, env, runtime and region tags. OR combines values of one key, AND combines keys, * is a wildcard, and rules starting with ! exclude. The table below updates as you type.'
                  )}
                </Text>
              </Stack>
              <Stack gap="md">
                <SectionTitle>{t('Layer versions')}</SectionTitle>
                <SegmentedControl<LayerPolicy>
                  aria-label={t('Layer version policy')}
                  value={policy}
                  onChange={setPolicy}
                >
                  <SegmentedControl.Item key="pinned">
                    {t('Pinned')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="patch">
                    {t('Patch updates')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="latest">
                    {t('Latest')}
                  </SegmentedControl.Item>
                </SegmentedControl>
                <Container border="primary" radius="md" padding="lg">
                  <Stack gap="sm">
                    <Text size="sm">
                      {policy === 'pinned'
                        ? t(
                            'Functions keep the versions below until you change them here.'
                          )
                        : policy === 'patch'
                          ? t(
                              'Patch releases of the SDK and extension roll out automatically; minor and major updates wait for you.'
                            )
                          : t('Every new layer version rolls out on the next sync.')}
                    </Text>
                    <Flex justify="between">
                      <Text size="sm" variant="muted">
                        {t('Python SDK layer')}
                      </Text>
                      <Text size="sm" monospace>
                        SentryPythonServerlessSDK:312 (3.0.0)
                      </Text>
                    </Flex>
                    <Flex justify="between">
                      <Text size="sm" variant="muted">
                        {t('Extension layer')}
                      </Text>
                      <Text size="sm" monospace>
                        SentryLambdaExtension:4 (0.1.0)
                      </Text>
                    </Flex>
                  </Stack>
                </Container>
              </Stack>
            </Grid>

            <Stack gap="md">
              <SectionTitle>
                {tct(
                  'Functions: [rule] by rule, [manual] manual, [drift] drifted, [none] not instrumented',
                  {
                    rule: counts.rule ?? 0,
                    manual: counts.manual ?? 0,
                    drift: counts.drift ?? 0,
                    none: counts['not-instrumented'] ?? 0,
                  }
                )}
              </SectionTitle>
              <CoverageTable>
                <SimpleTable.Header>
                  <SimpleTable.HeaderCell>{t('Function')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Runtime')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Layers')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{t('Why')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell>{null}</SimpleTable.HeaderCell>
                </SimpleTable.Header>
                {plans.map(({row, status, reason}) => {
                  const label = STATUS_LABELS[status];
                  const changed = status !== row.instrumentation;
                  return (
                    <SimpleTable.Row key={row.name}>
                      <SimpleTable.RowCell>
                        <Stack gap="0">
                          {row.known ? (
                            <Link to={functionUrl(organization, row.name, timeQuery)}>
                              <Text bold>{row.name}</Text>
                            </Link>
                          ) : (
                            <Text bold>{row.name}</Text>
                          )}
                          <Text size="xs" variant="muted">
                            {row.region} · env:{row.env} · team:{row.team}
                          </Text>
                        </Stack>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Text size="sm" monospace>
                          {row.runtime}
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Flex gap="xs">
                          <Tag variant={label.variant}>{label.label}</Tag>
                          {changed && <Tag variant="promotion">{t('after save')}</Tag>}
                        </Flex>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Stack gap="0">
                          <Text
                            size="xs"
                            monospace
                            variant={row.sdkLayer ? undefined : 'muted'}
                          >
                            {row.sdkLayer ?? t('no SDK layer')}
                          </Text>
                          <Text
                            size="xs"
                            monospace
                            variant={row.extensionLayer ? undefined : 'muted'}
                          >
                            {row.extensionLayer ?? t('no extension')}
                          </Text>
                        </Stack>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Text size="sm" variant="muted">
                          {reason}
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell justify="end">
                        {status === 'drift' && <ReinstrumentButton name={row.name} />}
                        {status === 'manual' && (
                          <ReinstrumentButton
                            name={row.name}
                            label={t('Manage with rules')}
                          />
                        )}
                      </SimpleTable.RowCell>
                    </SimpleTable.Row>
                  );
                })}
              </CoverageTable>
              <Flex>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    plans
                      .filter(
                        plan =>
                          plan.status !== plan.row.instrumentation &&
                          plan.status === 'rule'
                      )
                      .forEach(plan =>
                        mockActions.setInstrumentation(plan.row.name, 'rule')
                      );
                    addSuccessMessage(
                      t(
                        'Rules saved. %s functions are instrumented by rule; changes roll out on the next sync.',
                        plans.filter(plan => plan.status === 'rule').length
                      )
                    );
                  }}
                >
                  {t('Save rules')}
                </Button>
              </Flex>
            </Stack>

            <Stack gap="md">
              <SectionTitle>{t('Instrument from code instead')}</SectionTitle>
              <Text size="sm" variant="muted">
                {t(
                  'Same result for teams that manage functions in infrastructure as code. All of them set the release from git and create a deploy per Lambda version.'
                )}
              </Text>
              <Tabs defaultValue="cli">
                <TabList>
                  <TabList.Item key="cli">sentry-cli</TabList.Item>
                  <TabList.Item key="cdk">AWS CDK</TabList.Item>
                  <TabList.Item key="terraform">Terraform</TabList.Item>
                  <TabList.Item key="container">{t('Container image')}</TabList.Item>
                </TabList>
                <TabPanels>
                  <TabPanels.Item key="cli">
                    <SnippetWrapper>
                      <CodeBlock language="bash">{SNIPPETS.cli}</CodeBlock>
                    </SnippetWrapper>
                  </TabPanels.Item>
                  <TabPanels.Item key="cdk">
                    <SnippetWrapper>
                      <CodeBlock language="typescript">{SNIPPETS.cdk}</CodeBlock>
                    </SnippetWrapper>
                  </TabPanels.Item>
                  <TabPanels.Item key="terraform">
                    <SnippetWrapper>
                      <CodeBlock language="hcl">{SNIPPETS.terraform}</CodeBlock>
                    </SnippetWrapper>
                  </TabPanels.Item>
                  <TabPanels.Item key="container">
                    <SnippetWrapper>
                      <CodeBlock language="dockerfile">{SNIPPETS.container}</CodeBlock>
                    </SnippetWrapper>
                  </TabPanels.Item>
                </TabPanels>
              </Tabs>
            </Stack>
          </Stack>
        </Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

const RuleInput = styled(Input)`
  flex: 1;
  font-family: ${p => p.theme.font.family.mono};
`;

const AccountsTable = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1.5fr) max-content max-content repeat(
      2,
      max-content
    ) minmax(0, 1fr);
`;

const CoverageTable = styled(SimpleTable)`
  grid-template-columns: minmax(170px, 1.2fr) max-content max-content minmax(
      200px,
      1.2fr
    ) minmax(0, 2fr) max-content;
`;

const SnippetWrapper = styled('div')`
  padding-top: ${p => p.theme.space.lg};
`;
