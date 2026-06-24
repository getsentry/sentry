import styled from '@emotion/styled';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';
import {ScmCollapsibleReveal} from 'sentry/views/onboarding/components/scmCollapsibleReveal';
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
                <Text bold size="sm" density="comfortable">
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
        {/* Selecting the card expands its body; ScmCollapsibleReveal's height
            tween lets cards in scmCreateProject's layout="position" group
            reflow smoothly. */}
        <ScmCollapsibleReveal open={Boolean(children)}>
          <ExpandedBody>{children}</ExpandedBody>
        </ScmCollapsibleReveal>
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
