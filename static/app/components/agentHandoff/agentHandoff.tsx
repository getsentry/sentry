import {
  createContext,
  useContext,
  useRef,
  type ClipboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import styled from '@emotion/styled';
import {IconCopy} from '@sentry/icons/copy';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {InfoText} from '@sentry/scraps/info';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {useAgentHandoff, type AgentHandoffFlow} from './useAgentHandoff';

type AgentHandoffProps = {
  children: ReactNode;
  flow: AgentHandoffFlow;
};

function useAgentHandoffState(flow: AgentHandoffFlow) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {disableIpPinning: false},
    validators: {onDynamic: z.object({disableIpPinning: z.boolean()})},
  });
  const disableIpPinning = useStore(form.store, state => state.values.disableIpPinning);
  const handoff = useAgentHandoff(flow);

  return {disableIpPinning, flow, form, handoff};
}

type AgentHandoffContextValue = ReturnType<typeof useAgentHandoffState>;

const AgentHandoffContext = createContext<AgentHandoffContextValue | null>(null);

function useAgentHandoffContext() {
  const context = useContext(AgentHandoffContext);
  if (!context) {
    throw new Error('AgentHandoff compound components must be used within AgentHandoff');
  }

  return context;
}

function AgentHandoffRoot({children, flow}: AgentHandoffProps) {
  const context = useAgentHandoffState(flow);

  return (
    <AgentHandoffContext.Provider value={context}>
      {children}
    </AgentHandoffContext.Provider>
  );
}

function Details() {
  const {links} = useLegacyStore(ConfigStore);
  const {disableIpPinning, form, handoff} = useAgentHandoffContext();
  const guideUrl = `${ConfigStore.get('urlPrefix').replace(/\/$/, '')}/agent-handoff/`;
  const previewUrl = new URL('/agent-handoff/?preview=1', links.sentryUrl).href;

  function copyPrompt() {
    if (handoff.isPending) {
      return;
    }

    handoff.mutate(
      {disableIpPinning},
      {onSuccess: () => toast.success(t('Agent prompt copied to clipboard'))}
    );
  }

  return (
    <Stack gap="xl">
      <Text as="p">
        {t(
          'Copy and paste this prompt in your favorite coding agent, opened in the project you want to instrument with Sentry, and let it handle the setup.'
        )}
      </Text>
      <CopyableAgentPrompt
        busy={handoff.isPending}
        guideUrl={guideUrl}
        onCopy={copyPrompt}
      />
      <Text as="p" size="sm" variant="secondary">
        <ExternalLink href={previewUrl}>{t('Preview the handoff markdown')}</ExternalLink>
      </Text>
      <Stack gap="sm">
        <Disclosure>
          <Disclosure.Title>{t('Advanced options')}</Disclosure.Title>
          <Disclosure.Content>
            <form.AppField name="disableIpPinning">
              {field => (
                <field.Checkbox
                  label={t('Disable IP pinning')}
                  hintText={t(
                    'Only enable this option if your agent runs on a different machine. If you’re unsure, leave IP pinning enabled. Disable it only if your agent cannot access the handoff prompt because its IP address differs.'
                  )}
                  checked={field.state.value}
                  disabled={handoff.isPending}
                  onChange={checked => {
                    field.handleChange(checked);
                    handoff.reset();
                  }}
                />
              )}
            </form.AppField>
          </Disclosure.Content>
        </Disclosure>
      </Stack>
      {disableIpPinning && (
        <Alert variant="warning">
          {t(
            'Keep this prompt private. Anyone with the prompt can use it to authenticate the Sentry CLI to your account. Don’t paste it while screen sharing or recording.'
          )}
        </Alert>
      )}
      {handoff.error && <Alert variant="danger">{handoff.error.message}</Alert>}
      <Stack gap="md">
        <Text bold>{t('Your agent will:')}</Text>
        <Grid paddingLeft="lg" gap="md">
          {layoutProps => (
            <SetupStepsList {...layoutProps} symbol="numeric">
              <ListItem data-handoff-step="">
                {tct('Install and automatically authenticate the [cli:Sentry CLI].', {
                  cli: <ExternalLink href="https://cli.sentry.dev/" />,
                })}
              </ListItem>
              <ListItem data-handoff-step="">
                {t('Set up Sentry for your project.')}
              </ListItem>
              <ListItem data-handoff-step="">
                {t('Inspect your project to determine the best Sentry instrumentation.')}
              </ListItem>
              <ListItem data-handoff-step="">
                {t('Implement the instrumentation in your project.')}
              </ListItem>
              <ListItem data-handoff-step="">
                {t('Verify telemetry from your development environment.')}
              </ListItem>
            </SetupStepsList>
          )}
        </Grid>
      </Stack>
    </Stack>
  );
}

function CopyableAgentPrompt({
  busy,
  guideUrl,
  onCopy,
}: {
  busy: boolean;
  guideUrl: string;
  onCopy: () => void;
}) {
  const promptRef = useRef<HTMLDivElement>(null);

  function selectPrompt(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!promptRef.current) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(promptRef.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  function handleNativeCopy(event: ClipboardEvent) {
    event.preventDefault();
    onCopy();
  }

  return (
    <Container
      background="secondary"
      radius="md"
      padding="lg"
      paddingRight="3xl"
      position="relative"
      onCopy={handleNativeCopy}
    >
      <Text
        ref={promptRef}
        as="div"
        monospace
        size="sm"
        textWrap="wrap"
        onPointerDown={selectPrompt}
      >
        {tct(
          'Fetch and follow the instructions at[break][guideUrl]. Your secret token is [token].',
          {
            break: <br />,
            guideUrl,
            token: (
              <MaskedToken
                monospace
                variant="warning"
                title={t('The secret token authenticates the CLI via this prompt')}
              >
                `sntryh_*`
              </MaskedToken>
            ),
          }
        )}
      </Text>
      <Container position="absolute" top="8px" right="8px">
        <Button
          aria-label={t('Copy agent prompt')}
          busy={busy}
          disabled={busy}
          icon={<IconCopy />}
          size="zero"
          variant="transparent"
          onClick={onCopy}
        />
      </Container>
    </Container>
  );
}

const MaskedToken = styled(InfoText)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0 ${p => p.theme.space['2xs']};
  text-decoration: none;
`;

export const AgentHandoff = Object.assign(AgentHandoffRoot, {Details});

const SetupStepsList = styled(List)`
  & [data-handoff-step]::before {
    top: 50%;
    transform: translateY(calc(-50% - 1px));
  }
`;
