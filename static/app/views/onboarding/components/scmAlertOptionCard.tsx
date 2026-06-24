import {AnimatePresence, motion} from 'framer-motion';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';
import {ScmSelectableContainer} from 'sentry/views/onboarding/components/scmSelectableContainer';

interface ScmAlertOptionCardProps {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  children?: React.ReactNode;
  description?: string;
}

export function ScmAlertOptionCard({
  label,
  description,
  isSelected,
  onSelect,
  children,
}: ScmAlertOptionCardProps) {
  return (
    <ScmSelectableContainer isSelected={isSelected} padding="lg">
      <Stack gap="0">
        <ScmCardButton
          role="radio"
          aria-checked={isSelected}
          onClick={onSelect}
          style={{width: '100%'}}
        >
          <Grid gap="md" align="start" columns="min-content 1fr">
            <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
            <Stack gap="xs">
              <Text bold={isSelected} size="md" density="comfortable">
                {label}
              </Text>
              {description && (
                <Text variant="secondary" size="sm" density="comfortable">
                  {description}
                </Text>
              )}
            </Stack>
          </Grid>
        </ScmCardButton>
        {/* Selecting the card expands its body; the height tween mirrors
            ScmCollapsibleSection so cards in scmCreateProject's
            layout="position" group reflow smoothly. initial={false} keeps a
            preselected card expanded without animating on mount. */}
        <AnimatePresence initial={false}>
          {children && (
            <motion.div
              key="content"
              initial={{height: 0, opacity: 0}}
              animate={{height: 'auto', opacity: 1}}
              exit={{height: 0, opacity: 0}}
              transition={{duration: 0.2, ease: 'easeOut'}}
              style={{overflow: 'hidden', width: '100%'}}
            >
              {/* padding-top lives inside the animated body so the gap collapses
                  with the height tween; padding-left aligns it under the label. */}
              <Container paddingTop="md" paddingLeft="2xl">
                {children}
              </Container>
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>
    </ScmSelectableContainer>
  );
}
