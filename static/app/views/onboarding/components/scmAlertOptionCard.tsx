import styled from '@emotion/styled';
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
    <ScmSelectableContainer isSelected={isSelected}>
      <Stack gap="0">
        {/* The padding lives on the button (not the card) so the whole header,
            edge to edge, is part of the click target. */}
        <ScmCardButton
          role="radio"
          aria-checked={isSelected}
          onClick={onSelect}
          style={{width: '100%'}}
        >
          <Container padding="lg">
            <Grid
              columns="min-content 1fr"
              gap="xs md"
              align="center"
              areas={`
                "radio label"
                ".     description"
              `}
            >
              <Container area="radio">
                <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
              </Container>
              <Container area="label">
                <Text bold={isSelected} size="md" density="comfortable">
                  {label}
                </Text>
              </Container>
              {description && (
                <Container area="description">
                  <Text variant="secondary" size="sm" density="comfortable">
                    {description}
                  </Text>
                </Container>
              )}
            </Grid>
          </Container>
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
              <ExpandedBody>{children}</ExpandedBody>
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>
    </ScmSelectableContainer>
  );
}

// The body indents to line up under the label (button padding + radio width +
// grid column gap) and carries its own right/bottom padding so input focus
// rings clear the animated overflow:hidden bounds. The top gap comes from the
// header button's own bottom padding.
const ExpandedBody = styled('div')`
  padding: 0 ${p => p.theme.space.lg} ${p => p.theme.space.lg};
  padding-left: calc(${p => p.theme.space.lg} + 20px + ${p => p.theme.space.md});
`;
