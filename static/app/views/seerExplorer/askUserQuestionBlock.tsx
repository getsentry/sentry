import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Input} from 'sentry/components/core/input';
import {Radio} from 'sentry/components/core/radio';
import type {Question} from 'sentry/views/seerExplorer/hooks/usePendingUserInput';

interface AskUserQuestionBlockProps {
  currentQuestion: Question;
  customText: string;
  isOtherSelected: boolean;
  onCustomTextChange: (text: string) => void;
  onSelectOption: (index: number) => void;
  questionIndex: number;
  selectedOption: number;
  isFocused?: boolean;
  isLast?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function AskUserQuestionBlock({
  currentQuestion,
  customText,
  isFocused,
  isLast,
  isOtherSelected,
  onClick,
  onCustomTextChange,
  onMouseEnter,
  onMouseLeave,
  onSelectOption,
  questionIndex,
  selectedOption,
}: AskUserQuestionBlockProps) {
  const customInputRef = useRef<HTMLInputElement>(null);

  const optionsCount = currentQuestion.options.length;

  // Auto-focus the custom input when "Other" is selected, blur when not
  useEffect(() => {
    if (isOtherSelected) {
      customInputRef.current?.focus();
    } else {
      customInputRef.current?.blur();
    }
  }, [isOtherSelected]);

  const handleOptionClick = (index: number) => {
    onSelectOption(index);
  };

  return (
    <Block
      isFocused={isFocused}
      isLast={isLast}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <AnimatePresence>
        <motion.div
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: 10}}
        >
          <Flex align="start" width="100%">
            <BlockContentWrapper>
              <AnimatePresence mode="wait">
                <motion.div
                  key={questionIndex}
                  initial={{opacity: 0, x: 20}}
                  animate={{opacity: 1, x: 0}}
                  exit={{opacity: 0, x: -20}}
                  transition={{duration: 0.12, ease: 'easeOut'}}
                >
                  <QuestionContainer>
                    <Text>{currentQuestion.question}</Text>
                    <OptionsContainer>
                      {currentQuestion.options.map((option, index) => (
                        <OptionRow
                          key={index}
                          onClick={() => handleOptionClick(index)}
                          isSelected={selectedOption === index}
                        >
                          <Radio
                            checked={selectedOption === index}
                            onChange={() => handleOptionClick(index)}
                            name={`question-${questionIndex}`}
                            size="sm"
                          />
                          <OptionContent>
                            <Text size="sm">{option.label}</Text>
                            <Text variant="muted" size="sm">
                              {option.description}
                            </Text>
                          </OptionContent>
                        </OptionRow>
                      ))}
                      {/* Custom text input option (always visible) */}
                      <OptionRow
                        onClick={() => handleOptionClick(optionsCount)}
                        isSelected={isOtherSelected}
                      >
                        <Radio
                          checked={isOtherSelected}
                          onChange={() => handleOptionClick(optionsCount)}
                          name={`question-${questionIndex}`}
                          size="sm"
                        />
                        <CustomInputWrapper>
                          <CustomInput
                            ref={customInputRef}
                            value={customText}
                            onChange={e => onCustomTextChange(e.target.value)}
                            onClick={e => {
                              e.stopPropagation();
                              handleOptionClick(optionsCount);
                            }}
                            placeholder="Type your own answer..."
                            size="sm"
                          />
                        </CustomInputWrapper>
                      </OptionRow>
                    </OptionsContainer>
                  </QuestionContainer>
                </motion.div>
              </AnimatePresence>
            </BlockContentWrapper>
          </Flex>
        </motion.div>
      </AnimatePresence>
    </Block>
  );
}

export default AskUserQuestionBlock;

const Block = styled('div')<{isFocused?: boolean; isLast?: boolean}>`
  width: 100%;
  border-bottom: ${p => (p.isLast ? 'none' : `1px solid ${p.theme.border}`)};
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  background: ${p =>
    p.isFocused
      ? p.theme.tokens.interactive.transparent.neutral.background.active
      : 'transparent'};
`;

const BlockContentWrapper = styled('div')`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: ${p => p.theme.space.xl};
`;

const QuestionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const OptionsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const OptionRow = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const OptionContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  flex: 1;
  padding-top: 2px;
`;

const CustomInputWrapper = styled('div')`
  flex: 1;
`;

const CustomInput = styled(Input)`
  width: 100%;
`;
