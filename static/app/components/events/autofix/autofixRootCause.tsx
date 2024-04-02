import {type ReactNode, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import type {
  AutofixRootCauseData,
  AutofixRootCauseSuggestedFix,
  AutofixRootCauseSuggestedFixSnippet,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import TextArea from 'sentry/components/forms/controls/textarea';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {getPrismLanguage} from 'sentry/utils/prism';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  runId: string;
  selectedOption: {option_id: string} | {custom_response: string} | null;
};

const animationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0},
  animate: {opacity: 1},
  transition: {duration: 0.3},
};

function RootCauseContent({
  selected,
  children,
}: {
  children: ReactNode;
  selected: boolean;
}) {
  return (
    <ContentWrapper selected={selected}>
      <AnimatePresence initial={false}>
        {selected && (
          <AnimationWrapper key="content" {...animationProps}>
            {children}
          </AnimationWrapper>
        )}
      </AnimatePresence>
    </ContentWrapper>
  );
}

function SuggestedFixSnippet({snippet}: {snippet: AutofixRootCauseSuggestedFixSnippet}) {
  const extension = getFileExtension(snippet.file_path);
  const lanugage = extension ? getPrismLanguage(extension) : undefined;

  return (
    <div>
      <StyledCodeSnippet filename={snippet.file_path} language={lanugage}>
        {snippet.snippet}
      </StyledCodeSnippet>
    </div>
  );
}

function CauseSuggestedFix({
  fixNumber,
  suggestedFix,
  groupId,
  runId,
  causeId,
}: {
  causeId: string;
  fixNumber: number;
  groupId: string;
  runId: string;
  suggestedFix: AutofixRootCauseSuggestedFix;
}) {
  const {isLoading, mutate: handleSelectFix} = useSelectCause({groupId, runId});

  return (
    <SuggestedFixWrapper>
      <SuggestedFixHeader>
        <strong>{t('Suggested Fix #%s: %s', fixNumber, suggestedFix.title)}</strong>
        <Button
          size="xs"
          onClick={() => handleSelectFix({causeId, fixId: suggestedFix.id})}
          busy={isLoading}
        >
          {t('Continue With This Fix')}
        </Button>
      </SuggestedFixHeader>
      <p>{suggestedFix.description}</p>
      {suggestedFix.snippet && <SuggestedFixSnippet snippet={suggestedFix.snippet} />}
    </SuggestedFixWrapper>
  );
}

function CauseOption({
  cause,
  selected,
  setSelectedId,
  runId,
  groupId,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  runId: string;
  selected: boolean;
  setSelectedId: (id: string) => void;
}) {
  return (
    <RootCauseOption selected={selected} onClick={() => setSelectedId(cause.id)}>
      {!selected && <InteractionStateLayer />}
      <Title>{cause.title}</Title>
      <RootCauseContent selected={selected}>
        <CauseDescription>{cause.description}</CauseDescription>
        {cause.suggested_fixes?.map((fix, index) => (
          <CauseSuggestedFix
            causeId={cause.id}
            key={fix.title}
            suggestedFix={fix}
            fixNumber={index + 1}
            groupId={groupId}
            runId={runId}
          />
        )) ?? null}
      </RootCauseContent>
    </RootCauseOption>
  );
}

function ProvideYourOwn({
  selected,
  setSelectedId,
}: {
  selected: boolean;
  setSelectedId: (id: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <RootCauseOption selected={selected} onClick={() => setSelectedId('custom')}>
      {!selected && <InteractionStateLayer />}
      <Title>{t('Provide your own')}</Title>
      <RootCauseContent selected={selected}>
        <CustomTextArea
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          autosize
          placeholder={t(
            'This error seems to be caused by ... go look at path/file to make sure it does …'
          )}
        />
        <OptionFooter>
          <Button size="xs" disabled={!text}>
            {t('Continue With This Fix')}
          </Button>
        </OptionFooter>
      </RootCauseContent>
    </RootCauseOption>
  );
}

function useSelectCause({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({causeId, fixId}: {causeId: string; fixId: string}) => {
      return api.requestPromise(`/issues/${groupId}/ai-autofix/select-cause/`, {
        method: 'POST',
        data: {
          run_id: runId,
          cause_id: causeId,
          fix_id: fixId,
        },
      });
    },
    onSuccess: () => {
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(groupId),
        data => {
          if (!data || !data.autofix) {
            return data;
          }

          return {
            ...data,
            autofix: {
              ...data.autofix,
              status: 'PROCESSING',
              root_cause: {},
            },
          };
        }
      );
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the root cause.'));
    },
  });
}

export function AutofixRootCause({
  causes,
  groupId,
  runId,
  selectedOption,
}: AutofixRootCauseProps) {
  const [selectedId, setSelectedId] = useState(() => causes[0].id);

  if (selectedOption) {
    if ('custom_response' in selectedOption) {
      return (
        <CausesContainer>
          <CausesHeader>
            <TruncatedContent>
              {t('Custom response given: %s', selectedOption.custom_response)}
            </TruncatedContent>
          </CausesHeader>
        </CausesContainer>
      );
    }

    const selectedCause = causes.find(cause => cause.id === selectedOption.option_id);

    if (!selectedCause) {
      return <Alert type="error">{t('Selected option not found.')}</Alert>;
    }

    return (
      <CausesContainer>
        <CausesHeader>
          <TruncatedContent>
            {t('Root cause selected: %s', selectedCause.title)}
          </TruncatedContent>
        </CausesHeader>
      </CausesContainer>
    );
  }

  return (
    <CausesContainer>
      <CausesHeader>
        {tn(
          'Sentry has identified %s potential root cause. You may select the presented root cause or provide your own.',
          'Sentry has identified %s potential root causes. You may select one of the presented root causes or provide your own.',
          causes.length
        )}
      </CausesHeader>
      <OptionsPadding>
        <OptionsWrapper>
          {causes.map(cause => (
            <CauseOption
              key={cause.id}
              cause={cause}
              selected={cause.id === selectedId}
              setSelectedId={setSelectedId}
              runId={runId}
              groupId={groupId}
            />
          ))}
          <ProvideYourOwn
            selected={selectedId === 'custom'}
            setSelectedId={setSelectedId}
          />
        </OptionsWrapper>
      </OptionsPadding>
    </CausesContainer>
  );
}

const CausesContainer = styled('div')``;

const CausesHeader = styled('div')`
  padding: 0 ${space(2)};
`;

const OptionsPadding = styled('div')`
  padding: ${space(2)};
`;
const OptionsWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const RootCauseOption = styled('div')<{selected: boolean}>`
  position: relative;
  padding: ${space(2)};
  background: ${p => (p.selected ? p.theme.background : p.theme.backgroundElevated)};
  cursor: ${p => (p.selected ? 'default' : 'pointer')};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const Title = styled('div')`
  font-weight: bold;
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-top: ${space(1)};
`;

const SuggestedFixWrapper = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.alert.info.border};
  background-color: ${p => p.theme.alert.info.backgroundLight};
  border-radius: ${p => p.theme.borderRadius};
  margin-top: ${space(1)};

  p {
    margin: ${space(1)} 0 0 0;
  }
`;

const SuggestedFixHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${space(2)};
`;

const ContentWrapper = styled(motion.div)<{selected: boolean}>`
  display: grid;
  grid-template-rows: ${p => (p.selected ? '1fr' : '0fr')};
  transition: grid-template-rows 300ms;
  will-change: grid-template-rows;

  > div {
    padding: 0 1px; // So that focused element outlines don't get cut off
    overflow: hidden;
  }
`;

const AnimationWrapper = styled(motion.div)``;

const CustomTextArea = styled(TextArea)`
  margin-top: ${space(2)};
`;

const OptionFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${space(2)};
`;

const TruncatedContent = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
