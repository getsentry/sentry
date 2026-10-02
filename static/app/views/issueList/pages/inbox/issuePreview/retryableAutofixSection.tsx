import {createContext, use} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {
  type AutofixExplorerStep,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixResetPrompt} from 'sentry/components/events/autofix/v3/autofixResetPrompt';
import {useResetAutofixStep} from 'sentry/components/events/autofix/v3/useResetAutofixStep';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';

interface RetryableAutofixSectionContextValue {
  canReset: boolean;
  handleReset: (userContext?: string) => Promise<void>;
  setShouldShowReset: (shouldShowReset: boolean) => void;
  shouldShowReset: boolean;
}

const RetryableAutofixSectionContext =
  createContext<RetryableAutofixSectionContextValue | null>(null);

export function RetryableAutofixSection({
  autofix,
  children,
  section,
  step,
}: {
  autofix: ReturnType<typeof useExplorerAutofix>;
  children: React.ReactNode;
  section: AutofixSection;
  step: AutofixExplorerStep;
}) {
  const {canReset, shouldShowReset, setShouldShowReset, handleReset} =
    useResetAutofixStep({
      autofix,
      section,
      step,
    });

  return (
    <RetryableAutofixSectionContext
      value={{
        canReset,
        handleReset,
        setShouldShowReset,
        shouldShowReset,
      }}
    >
      {children}
    </RetryableAutofixSectionContext>
  );
}

function RetryButton() {
  const {canReset, setShouldShowReset} = useRetryableAutofixSection();

  return (
    <Button
      size="xs"
      variant="transparent"
      icon={<IconRefresh size="xs" />}
      aria-label={t('Re-run step')}
      tooltipProps={{title: t('Re-run step')}}
      onClick={() => setShouldShowReset(true)}
      disabled={!canReset}
    />
  );
}

function ResetPrompt({
  placeholder,
  prompt,
}: {
  placeholder: string;
  prompt: React.ReactNode;
}) {
  const {handleReset, setShouldShowReset, shouldShowReset} = useRetryableAutofixSection();

  return shouldShowReset ? (
    <Container paddingBottom="xl">
      <AutofixResetPrompt
        onClosePrompt={() => setShouldShowReset(false)}
        onReset={handleReset}
        placeholder={placeholder}
        prompt={prompt}
      />
    </Container>
  ) : null;
}

function useRetryableAutofixSection() {
  const context = use(RetryableAutofixSectionContext);
  if (!context) {
    throw new Error(
      'RetryableAutofixSection components must be rendered inside RetryableAutofixSection'
    );
  }
  return context;
}

RetryableAutofixSection.Button = RetryButton;
RetryableAutofixSection.Prompt = ResetPrompt;
