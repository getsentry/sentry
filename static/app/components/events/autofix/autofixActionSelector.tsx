import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

interface Option<T extends string> {
  key: T;
  label: string;
  active?: boolean;
}

interface Props<T extends string> {
  children: (selectedOption: Option<T>) => React.ReactNode;
  onBack: () => void;
  onSelect: (value: T) => void;
  options: Array<Option<T>>;
  selected: T | null;
}

function AutofixActionSelector<T extends string>({
  options,
  selected,
  onSelect,
  onBack,
  children,
}: Props<T>) {
  const selectedOption = options.find(opt => opt.key === selected);

  return (
    <Container>
      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div
            key="options"
            initial="initial"
            animate="visible"
            variants={{
              initial: {opacity: 0, scale: 1.05},
              visible: {opacity: 1, scale: 1},
            }}
            transition={testableTransition({duration: 0.1})}
          >
            <ButtonBar gap={1}>
              {options.map(option => (
                <Button
                  key={option.key}
                  priority={option.active ? 'primary' : 'default'}
                  onClick={() => onSelect(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </ButtonBar>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            transition={testableTransition({duration: 0.1})}
          >
            <ContentWrapper>
              <BackButton
                size="xs"
                icon={<IconArrow direction="left" size="xs" />}
                onClick={onBack}
                title={t('Back to options')}
                aria-label={t('Back to options')}
              />
              <ContentArea>{selectedOption && children(selectedOption)}</ContentArea>
            </ContentWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  );
}

const Container = styled('div')`
  min-height: 40px;
`;

const ContentWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const BackButton = styled(Button)`
  flex-shrink: 0;
  height: 40px;
`;

const ContentArea = styled('div')`
  flex-grow: 1;
`;

export default AutofixActionSelector;
