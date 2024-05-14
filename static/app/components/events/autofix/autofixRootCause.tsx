import {type ReactNode, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {AutofixShowMore} from 'sentry/components/events/autofix/autofixShowMore';
import {
  type AutofixRootCauseData,
  type AutofixRootCauseSelection,
  type AutofixRootCauseSuggestedFix,
  type AutofixRootCauseSuggestedFixSnippet,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
} from 'sentry/components/events/autofix/useAutofix';
import TextArea from 'sentry/components/forms/controls/textarea';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {getPrismLanguage} from 'sentry/utils/prism';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
};

const animationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0},
  animate: {opacity: 1},
  transition: testableTransition({duration: 0.3}),
};

function useSelectCause({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      params:
        | {
            causeId: string;
            fixId: string;
          }
        | {
            customRootCause: string;
          }
    ) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data:
          'customRootCause' in params
            ? {
                run_id: runId,
                payload: {
                  type: 'select_root_cause',
                  custom_root_cause: params.customRootCause,
                },
              }
            : {
                run_id: runId,
                payload: {
                  type: 'select_root_cause',
                  cause_id: params.causeId,
                  fix_id: params.fixId,
                },
              },
      });
    },
    onSuccess: (_, params) => {
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
              steps: data.autofix.steps?.map(step => {
                if (step.type !== AutofixStepType.ROOT_CAUSE_ANALYSIS) {
                  return step;
                }

                return {
                  ...step,
                  selection:
                    'customRootCause' in params
                      ? {
                          custom_root_cause: params.customRootCause,
                        }
                      : {
                          cause_id: params.causeId,
                          fix_id: params.fixId,
                        },
                };
              }),
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
          analyticsEventName="Autofix: Root Cause Fix Selected"
          analyticsEventKey="autofix.root_cause_fix_selected"
          analyticsParams={{group_id: groupId}}
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
      <RootCauseOptionHeader>
        <Title>{cause.title}</Title>
        <Button
          icon={<IconChevron size="xs" direction={selected ? 'down' : 'right'} />}
          aria-label={t('Select root cause')}
          aria-expanded={selected}
          size="zero"
          borderless
        />
      </RootCauseOptionHeader>
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

function SelectedRootCauseOption({
  selectedCause,
  selectedFix,
}: {
  selectedCause: AutofixRootCauseData;
  selectedFix: AutofixRootCauseSuggestedFix;
}) {
  return (
    <RootCauseOption selected>
      <Title>{t('Selected Cause: %s', selectedCause.title)}</Title>
      <CauseDescription>{selectedCause.description}</CauseDescription>
      <SuggestedFixWrapper>
        <SuggestedFixHeader>
          <strong>{t('Selected Fix: %s', selectedFix.title)}</strong>
        </SuggestedFixHeader>
        <p>{selectedFix.description}</p>
        {selectedFix.snippet && <SuggestedFixSnippet snippet={selectedFix.snippet} />}
      </SuggestedFixWrapper>
    </RootCauseOption>
  );
}

function ProvideYourOwn({
  selected,
  setSelectedId,
  groupId,
  runId,
}: {
  groupId: string;
  runId: string;
  selected: boolean;
  setSelectedId: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const {isLoading, mutate: handleSelectFix} = useSelectCause({groupId, runId});

  return (
    <RootCauseOption selected={selected} onClick={() => setSelectedId('custom')}>
      {!selected && <InteractionStateLayer />}
      <RootCauseOptionHeader>
        <Title>{t('Provide your own')}</Title>
        <Button
          icon={<IconChevron size="xs" direction={selected ? 'down' : 'right'} />}
          aria-label={t('Provide your own root cause')}
          aria-expanded={selected}
          size="zero"
          borderless
        />
      </RootCauseOptionHeader>
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
          <Button
            size="xs"
            onClick={() => handleSelectFix({customRootCause: text})}
            disabled={!text}
            busy={isLoading}
            analyticsEventName="Autofix: Root Cause Custom Cause Provided"
            analyticsEventKey="autofix.root_cause_custom_cause_provided"
            analyticsParams={{group_id: groupId}}
          >
            {t('Continue With This Fix')}
          </Button>
        </OptionFooter>
      </RootCauseContent>
    </RootCauseOption>
  );
}

export function AutofixRootCause({
  causes,
  groupId,
  runId,
  rootCauseSelection,
}: AutofixRootCauseProps) {
  const [selectedId, setSelectedId] = useState(() => causes[0].id);

  if (rootCauseSelection) {
    if ('custom_root_cause' in rootCauseSelection) {
      return (
        <CausesContainer>
          <CustomRootCausePadding>
            <Title>{t('Custom Response Provided')}</Title>
            <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
          </CustomRootCausePadding>
        </CausesContainer>
      );
    }

    const selectedCause = causes.find(cause => cause.id === rootCauseSelection.cause_id);
    const selectedFix = selectedCause?.suggested_fixes?.find(
      fix => fix.id === rootCauseSelection.fix_id
    );

    if (!selectedCause || !selectedFix) {
      return <Alert type="error">{t('Selected root cause not found.')}</Alert>;
    }

    const otherCauses = causes.filter(cause => cause.id !== selectedCause.id);

    return (
      <CausesContainer>
        <SelectedRootCauseOption
          selectedFix={selectedFix}
          selectedCause={selectedCause}
        />
        {otherCauses.length > 0 && (
          <AutofixShowMore title={t('Show unselected causes')}>
            {otherCauses.map(cause => (
              <RootCauseOption selected key={cause.id}>
                <Title>{t('Cause: %s', cause.title)}</Title>
                <CauseDescription>{cause.description}</CauseDescription>
                {cause.suggested_fixes?.map(fix => (
                  <SuggestedFixWrapper key={fix.id}>
                    <SuggestedFixHeader>
                      <strong>{t('Fix: %s', fix.title)}</strong>
                    </SuggestedFixHeader>
                    <p>{fix.description}</p>
                    {fix.snippet && <SuggestedFixSnippet snippet={fix.snippet} />}
                  </SuggestedFixWrapper>
                ))}
              </RootCauseOption>
            ))}
          </AutofixShowMore>
        )}
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
            groupId={groupId}
            runId={runId}
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

const RootCauseOptionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
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
    /* So that focused element outlines don't get cut off */
    padding: 0 1px;
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

const CustomRootCausePadding = styled('div')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
`;
