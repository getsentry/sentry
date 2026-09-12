import type {ComponentType, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {IconInfo} from 'sentry/icons/iconInfo';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

import {ScmCardButton} from './scmCardButton';

interface ScmFeatureRowProps {
  description: string;
  icon: ComponentType<SVGIconProps>;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  volume: string;
  volumeTooltip: string;
  disabled?: boolean;
  disabledReason?: ReactNode;
  // The first row skips its top divider; the parent list draws the frame.
  isFirst?: boolean;
  isVolumeLoading?: boolean;
  showVolume?: boolean;
}

/**
 * A list entry for a product toggle: icon, label, description, and a checkbox
 * indicator. Meant to be stacked inside one framed list rather than laid out
 * as standalone cards. Selection lives on the row button; the checkbox only
 * mirrors it.
 */
export function ScmFeatureRow({
  icon: Icon,
  label,
  description,
  isSelected,
  disabled,
  disabledReason,
  isFirst,
  onClick,
  volume,
  volumeTooltip,
  isVolumeLoading,
  showVolume = true,
}: ScmFeatureRowProps) {
  return (
    <Tooltip title={disabledReason} disabled={!disabledReason} delay={500}>
      <RowButton
        disabled={disabled}
        onClick={onClick}
        role="checkbox"
        aria-checked={isSelected}
      >
        <Container borderTop={isFirst ? undefined : 'primary'} padding="xl">
          <Grid
            columns="min-content 1fr min-content"
            rows="min-content min-content"
            gap="xs lg"
            align="center"
            width="100%"
            areas={`
              "icon label       toggle"
              ".    description description"
            `}
          >
            <Flex area="icon" align="center" alignSelf="start" paddingTop="2xs">
              <Icon size="md" variant="secondary" />
            </Flex>

            <Container area="label">
              <Text bold size="md">
                {label}
              </Text>
            </Container>

            <Container area="description">
              <Text variant="muted" size="md" density="comfortable" textWrap="pretty">
                {description}
              </Text>
            </Container>

            <Flex area="toggle" align="center" alignSelf="start" gap="md">
              {showVolume &&
                (isVolumeLoading ? (
                  <Placeholder height="22px" width="100px" />
                ) : (
                  <Tooltip title={volumeTooltip} delay={100}>
                    <Tag variant="muted" icon={<IconInfo size="sm" />}>
                      {volume}
                    </Tag>
                  </Tooltip>
                ))}
              {/* Presentational only: let the row own hover and cursor. */}
              <Flex pointerEvents="none">
                <Checkbox
                  checked={isSelected}
                  disabled={disabled}
                  role="presentation"
                  tabIndex={-1}
                  readOnly
                />
              </Flex>
            </Flex>
          </Grid>
        </Container>
      </RowButton>
    </Tooltip>
  );
}

const RowButton = styled(ScmCardButton)`
  display: block;
  width: 100%;

  &:hover:not(:disabled) {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;
